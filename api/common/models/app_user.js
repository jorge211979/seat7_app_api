'use strict';

const md5 = require('md5');
const UploadService = require('../services/upload.js');

module.exports = function(AppUser) {
  const _404 = _ => {
    const err = new Error('The destination project doesn\'t exist');
    err.statusCode = 404;
    return err;
  };

  AppUser.disableRemoteMethodByName('replaceById');
  AppUser.disableRemoteMethodByName('prototype.patchAttributes');

  AppUser.observe('before save', async (ctx) => {
    const {BasePersistedModel} = AppUser.app.models;
    BasePersistedModel.skipAttributes(ctx);
    return;
  });

  AppUser.on('resetPasswordRequest', (info) => {
    const {user, accessToken} = info;

    if (user.active && accessToken) {
      const templateName = 'password-reset-request';
      const templateData = {
        user,
        token: accessToken.id,
      };

      AppUser.sendEmail2User(user, 'New password request', templateName, templateData);
    }
  });

  AppUser.findCompanyRole = async () => {
    return await AppUser.app.models.Role.findOne({where: {name: 'company'}});
  };

  AppUser.getAdminRole = _ => {
    return AppUser.app.models.Role.findOne({where: {name: 'admin'}});
  };

  AppUser.removeInjectedProperties = (record, requestOptions) => {
    delete record.emailverified;
    delete record.user_id;
    delete record.verificationtoken;

    // Admin users can add active users. Other registration methods require an admin approval
    if (
      !requestOptions.authorizedRoles ||
      !requestOptions.authorizedRoles.admin
    ) {
      delete record.active;
    }

    return record;
  };

  AppUser.setUserRole = async (userId, roleId) => {
    const userRole = {
      'principalType': AppUser.app.models.RoleMapping.USER,
      'principalId': userId,
      roleId,
    };
    return await AppUser.app.models.RoleMapping.create(userRole);
  };

  AppUser.registerUserCompany = (record, requestOptions, cb) => {
    const create = async () => {
      try {
        const userCompanyRole = await AppUser.findCompanyRole();

        if (!userCompanyRole) {
          throw new Error('Unexpected error: Company role not found.');
        }

        const userdata = AppUser.removeInjectedProperties(record, requestOptions);
        const user = await AppUser.create(userdata);
        const company = await AppUser.app.models.company.create({
          name: userdata.company_name,
        });

        await AppUser.app.models.user_company.create({
          'user_id': user.user_id,
          'company_id': company.id,
        });

        await AppUser.setUserRole(user.user_id, userCompanyRole.id);

        AppUser.sendRegistrationEmail(user);

        if (user.active) {
          AppUser.sendActiveStatusChangedEmail(user, null);
        } else {
          AppUser.sendNewRegistrationNotification2Admins(user, company);
        }

        cb(null, true);
      } catch (err) {
        // console.log(err);
        cb(err, null);
      }
    };

    create();
  };

  AppUser.remoteMethod('registerUserCompany', {
    description: 'Creates a new user with company role and relates it with the company_name attribute',
    returns: {arg: 'data', type: 'object', root: true},
    http: {path: '/user_company', verb: 'post'},
    accepts: [
      {arg: 'record', type: 'object', required: true, http: {source: 'body'}},
      {arg: 'options', type: 'object', http: 'optionsFromRequest'},
    ],
  });

  AppUser.updateUserCompany = async (userId, companyData) => {
    const userCompanies = await AppUser.app.models.UserCompany.find({
      where: {'user_id': userId},
      include: ['company'],
    });
    for (const userCompany of userCompanies) {
      await userCompany.company.update(companyData);
    }
    return userCompanies;
  };

  AppUser.updateSelf = (id, record, requestOptions, cb) => {
    const update = async () => {
      try {
        delete record.password;
        const userdata = AppUser.removeInjectedProperties(record, requestOptions);
        const user = await AppUser.upsertWithWhere(
          {'user_id': id},
          userdata
        );
        if (userdata.company_name) {
          await AppUser.updateUserCompany(
            user.user_id,
            {name: userdata.company_name}
          );
        };

        cb(null, true);
      } catch (err) {
        cb(err);
      }
    };

    update();
  };

  AppUser.remoteMethod('updateSelf', {
    description: 'Update user self data',
    returns: {arg: 'data', type: 'object', root: true},
    http: {path: '/:id', verb: 'put'},
    accepts: [
      {arg: 'id', type: 'number', required: true},
      {arg: 'record', type: 'object', http: {source: 'body'}},
      {arg: 'options', type: 'object', http: 'optionsFromRequest'},
    ],
  });

  AppUser.changeActiveStatus = async (id, active) => {
    const user = await AppUser.findById(id);
    if (user) {
      const oldActive = user.active;

      user.active = active;
      await user.save();

      if (oldActive !== user.active) {
        AppUser.sendActiveStatusChangedEmail(user, oldActive);
      }

      return user;
    }
    return false;
  };

  AppUser.activate = (id, cb) => {
    const activate = async () => {
      try {
        const user = await AppUser.changeActiveStatus(id, true);

        return cb(null, user ? true : false);
      } catch (err) {
        return cb(err);
      }
    };
    activate();
  };

  AppUser.remoteMethod('activate', {
    description: 'Changes user status to active',
    returns: {arg: 'data', type: 'object', root: true},
    http: {path: '/:id/activate', verb: 'get'},
    accepts: [
      {arg: 'id', type: 'number', required: true},
    ],
  });

  AppUser.deactivate = (id, cb) => {
    const deactivate = async () => {
      try {
        const user = await AppUser.changeActiveStatus(id, false);
        if (user) {
          AppUser._invalidateAccessTokensOfUsers([user.id], (err) => {
            return cb(err, true);
          });
        } else {
          return cb(null, false);
        }
      } catch (err) {
        return cb(err);
      }
    };
    deactivate();
  };

  AppUser.remoteMethod('deactivate', {
    description: 'Changes user status to deactivated',
    returns: {arg: 'data', type: 'object', root: true},
    http: {path: '/:id/deactivate', verb: 'get'},
    accepts: [
      {arg: 'id', type: 'number', required: true},
    ],
  });

  AppUser.beforeRemote('login', (ctx, instance, next) => {
    if (ctx.args && ctx.args.credentials && ctx.args.credentials.email) {
      const checkActive = async () => {
        const userEmail = ctx.args.credentials.email;
        const user = await AppUser.findOne({where: {email: userEmail}});
        // Deactivated cannot login
        if (user && user.active !== true) {
          ctx.args.credentials.password = '';
        }
        next();
      };
      checkActive();
    } else {
      next();
    }
  });

  AppUser.sendEmail2User = (userInstance, subject, mailTemplate, mailTemplateData = {}) => {
    const {Mailer} = AppUser.app.models;
    const templatePath = Mailer.getTemplatePath(mailTemplate);
    const html = Mailer.renderTemplate(templatePath, mailTemplateData);
    const to = userInstance.email;

    return new Promise((resolve, reject) => {
      Mailer.sendEmail({to, subject, html}, function(err, mail) {
        if (err) {
          console.log(`Error sending '${subject}' email to '${to}'`, err);

          return reject(err);
        }

        return resolve(mail);
      });
    });
  };

  AppUser.findAdminUsers = async _ => {
    const {RoleMapping} = AppUser.app.models;
    const adminRole = await AppUser.getAdminRole();
    if (adminRole) {
      const adminMapping = await RoleMapping.find({where: {roleId: adminRole.id, principalType: RoleMapping.USER}});
      const users = await Promise.all(adminMapping.map(userRole => AppUser.findById(userRole.principalId)));

      return users.filter(u => u && u.active);
    }

    return [];
  };

  AppUser.sendNewRegistrationNotification2Admins = async (newUser, company) => {
    const adminUsers = await AppUser.findAdminUsers();
    const templateName = 'new-account-created';
    const templateData = {newUser, company};

    adminUsers.forEach(userInstance => {//new-account-created
      templateData.adminUser = userInstance;
      AppUser.sendEmail2User(userInstance, 'New Registration Request', templateName, templateData);
    });
  };

  AppUser.sendRegistrationEmail = async userInstance => {
    try {
      const templateName = 'account-created';
      const templateData = {
        user: userInstance,
      };

      await AppUser.sendEmail2User(userInstance, 'Your account has been created', templateName, templateData);

      return true;
    } catch (err) {
      return false;
    }
  };

  AppUser.sendActiveStatusChangedEmail = async (userInstance, oldStatus) => {
    try {
      let templateName = null;
      let mailSubject = null;
      const templateData = {
        user: userInstance,
      };

      if (oldStatus === null && userInstance.active) {
        templateName = 'account-accepted';
        mailSubject = 'Account accepted';
      } else if (oldStatus === null && userInstance.active === false) {
        templateName = 'account-not-accepted';
        mailSubject = 'Account not accepted';
      }

      if (templateName && mailSubject) {
        await AppUser.sendEmail2User(userInstance, mailSubject, templateName, templateData);
      }

      return true;
    } catch (err) {
      return false;
    }
  };

  AppUser.uploadLogo = (userId, req, res, callback) => {
    (async _ => {
      try {
        const uploader = new UploadService();
        const user = await AppUser.findById(userId);

        if (!user) {
          throw _404();
        }

        const oldFile = user.logo_url;
        const timestamp = Date.now();
        const filename = `${md5(`${user.id}-logo`)}-${timestamp}`;
        const uploadedFile = await uploader.upload(req, res, 'user/logo', filename);
        const updated = await user.updateAttribute('logo_url', uploadedFile.key);

        if (oldFile) {
          try {
            await uploader.deleteFile(oldFile);
          } catch (err) {
            console.log('Error on delete file in S3');
          }
        }

        return callback(null, updated);
      } catch (err) {
        return callback(err);
      }
    })();
  };

  AppUser.remoteMethod('uploadLogo', {
    returns: {arg: 'data', type: 'object', root: true},
    http: {path: '/:id/logo/upload', verb: 'put'},
    accepts: [
      {arg: 'id', type: 'number', required: true},
      {arg: 'req', type: 'object', required: true, http: {source: 'req'}},
      {arg: 'res', type: 'object', required: true, http: {source: 'res'}},
    ],
  });
};
