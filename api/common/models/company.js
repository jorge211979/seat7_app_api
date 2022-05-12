'use strict';

module.exports = function(Company) {
  Company.uploadProjectBanner = (
    companyId, projectId, req, res, callback
  ) => {
    const Project = Company.app.models.project;
    const uploadFn = async _ => {
      try {
        const response = await Project.uploadBanner(companyId, projectId, req, res);

        return callback(null, response);
      } catch (err) {
        return callback(err);
      }
    };

    uploadFn();
  };

  Company.remoteMethod('uploadProjectBanner', {
    returns: {arg: 'data', type: 'object', root: true},
    http: {path: '/:id/projects/:project_id/banner/upload', verb: 'put'},
    accepts: [
      {arg: 'id', type: 'number', required: true},
      {arg: 'project_id', type: 'number', required: true},
      {arg: 'req', type: 'object', required: true, http: {source: 'req'}},
      {arg: 'res', type: 'object', required: true, http: {source: 'res'}},
    ],
  });

  Company.deleteProjectBannerFile = (companyId, projectId, callback) => {
    const Project = Company.app.models.project;
    (async _ => {
      try {
        const response = await Project.deleteBannerFile(companyId, projectId);

        return callback(null, response);
      } catch (err) {
        return callback(err);
      }
    })();
  };

  Company.remoteMethod('deleteProjectBannerFile', {
    returns: {arg: 'data', type: 'object', root: true},
    http: {path: '/:id/projects/:project_id/banner/file', verb: 'delete'},
    accepts: [
      {arg: 'id', type: 'number', required: true},
      {arg: 'project_id', type: 'number', required: true}
    ],
  });

  Company.upsertProjectBanner = (companyId, projectId, record, callback) => {
    const Project = Company.app.models.project;
    const upsertFn = async _ => {
      try {
        const response = await Project.upsertBannerData(companyId, projectId, record);
        return callback(null, response);
      } catch (err) {
        return callback(err);
      }
    };

    upsertFn();
  };

  Company.remoteMethod('upsertProjectBanner', {
    returns: {arg: 'data', type: 'object', root: true},
    http: {path: '/:id/projects/:project_id/banner_data', verb: 'put'},
    accepts: [
      {arg: 'id', type: 'number', required: true},
      {arg: 'project_id', type: 'number', required: true},
      {arg: 'record', type: 'object', http: {source: 'body'}},
    ],
  });

  Company.uploadProjectLogo = (
    companyId, projectId, req, res, callback
  ) => {
    const Project = Company.app.models.project;
    Project.uploadLogo(companyId, projectId, req, res)
      .then(response => callback(null, response))
      .catch(callback)
    ;
  };

  Company.remoteMethod('uploadProjectLogo', {
    returns: {arg: 'data', type: 'object', root: true},
    http: {path: '/:id/projects/:project_id/logo/upload', verb: 'put'},
    accepts: [
      {arg: 'id', type: 'number', required: true},
      {arg: 'project_id', type: 'number', required: true},
      {arg: 'req', type: 'object', required: true, http: {source: 'req'}},
      {arg: 'res', type: 'object', required: true, http: {source: 'res'}},
    ],
  });
};
