'use strict';
const xss = require('xss');

module.exports = function(ProjectSubmissionList) {
  ProjectSubmissionList.beforeRemote('prototype.__get__contacts', async ctx => {
    const {options} = ctx.args;
    let {filter} = ctx.args;

    if (options.authorizedRoles && options.authorizedRoles.admin) {
      return;
    }

    if (!filter) {
      filter = {};
    }

    if (!filter.where) {
      filter.where = {};
    }

    filter.where.contact_type = 'press_contact';
    ctx.args.filter = filter;
  });

  ProjectSubmissionList.beforeRemote('prototype.__count__contacts', async ctx => {
    const {options} = ctx.args;
    let {where} = ctx.args;

    if (options.authorizedRoles && options.authorizedRoles.admin) {
      return;
    }

    if (!where) {
      where = {};
    }

    where.contact_type = 'press_contact';
    ctx.args.where = where;
  });

  ProjectSubmissionList.afterRemote('prototype.__findById__contacts', async (ctx, contact) => {
    const {options} = ctx.args;

    if (options.authorizedRoles && options.authorizedRoles.admin) {
      return;
    }
    if (contact.contact_type !== 'press_contact') {
      const error = new Error('Not found');
      error.status = 404;

      throw error;
    }
  });

  const _sendEmailToContacts = async (submissionList, contacts, project) => {
    const {ProjectSubmissionListContact, Company, Mailer} = ProjectSubmissionList.app.models;
    if (contacts) {
      for (const contact of contacts) {
        const c = await ProjectSubmissionListContact.getContactFromTypeModel(contact);
        const company = await Company.findById(project.company_id);

        if (!c) continue;

        contact.name = contact.contact_type === 'publisher' ? c.contact_name || c.name : c.name;

        const templateName = 'publisher-received';
        const safeHtmlMessage = xss(submissionList.message);
        const templateData = {
          contact,
          submissionList,
          project,
          company,
          safeHtmlMessage,
        };

        const subject = submissionList.subject || project.title;
        const templatePath = Mailer.getTemplatePath(templateName);
        const html = Mailer.renderTemplate(templatePath, templateData);
        const to = contact.contact_email;

        Mailer.sendEmail({
          to,
          subject,
          html,
        }, (err, mail) => {
          if (err) {
            console.log(`Error sending '${subject}' email to '${to}'`, err);
            return false;
          }

          contact.updateAttribute('sent_at', Date.now());
        });
      }
    }
  };

  const _notifyAdmin = async (submissionList, contacts, project) => {
    const {AppUser} = ProjectSubmissionList.app.models;

    const templateName = 'project-sent-to-publishers';
    const subject = `Project "${project.title}" sent to publishers`;

    const adminUsers = await AppUser.findAdminUsers();

    adminUsers.forEach(user => {
      const templateData = {
        user,
        submissionList,
        project,
        contacts,
      };

      AppUser.sendEmail2User(user, subject, templateName, templateData);
    });
  };

  ProjectSubmissionList.send = (listId, options, cb) => {
    (async _ => {
      try {
        const {Project, ProjectSubmissionListContact} = ProjectSubmissionList.app.models;
        const submissionList = await ProjectSubmissionList.findById(listId);
        const project = await Project.findById(submissionList.project_id);
        const contactsFilter = {
          'list_id': submissionList.id,
          'sent_at': null,
        };

        const isAdmin = options.authorizedRoles && options.authorizedRoles.admin;
        if (!isAdmin) {
          contactsFilter.contact_type = 'press_contact';
        }

        const contacts = await ProjectSubmissionListContact.find({
          where: contactsFilter,
        });

        if (contacts.length) {
          _sendEmailToContacts(submissionList, contacts, project);

          submissionList.sent_at = Date.now();
          await submissionList.save();

          _notifyAdmin(submissionList, contacts, project);

          if (!project.sent_to_publishers) {
            project.sent_to_publishers = true;
            project.save();
          }
        }

        return cb(null, {sent: true});
      } catch (err) {
        return cb(null, {sent: false});
      }
    })();
  };

  ProjectSubmissionList.remoteMethod('send', {
    returns: {arg: 'data', type: 'object', root: true},
    http: {path: '/:id/send', verb: 'post'},
    accepts: [
      {arg: 'id', type: 'number', required: true},
      {arg: 'options', type: 'object', http: 'optionsFromRequest'},
    ],
  });
};
