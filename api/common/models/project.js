'use strict';

const md5 = require('md5');
const UploadService = require('../services/upload.js');

module.exports = function(Project) {
  Project.validatesInclusionOf('project_type', {in: ['production', 'finished']});

  Project.observe('before save', async function(ctx) {
    if (ctx.instance) {
      ctx.instance.updated_at = new Date();
    } else {
      ctx.data.updated_at = new Date();
    }
  });

  const _404 = _ => {
    const err = new Error('The destination project doesn\'t exist');
    err.statusCode = 404;
    return err;
  };

  Project.upsertBannerData = async (companyId, id, bannerData) => {
    const ProjectBanner = Project.app.models.project_banner;

    const project = await Project.findById(id);

    if (!project || project.company_id != companyId) {
      throw _404();
    }

    return await ProjectBanner.upsertData(project, bannerData);
  };

  Project.uploadBanner = async (companyId, id, req, res) => {
    const ProjectBanner = Project.app.models.project_banner;
    const project = await Project.findById(id);

    if (!project || project.company_id != companyId) {
      throw _404();
    }

    return await ProjectBanner.uploadBanner(project, req, res);
  };

  Project.deleteBannerFile = async (companyId, id) => {
    const ProjectBanner = Project.app.models.project_banner;
    const project = await Project.findById(id);

    if (!project || project.company_id != companyId) {
      throw _404();
    }

    return ProjectBanner.deleteFile(project);
  };

  Project.uploadLogo = async (companyId, id, req, res) => {
    const uploader = new UploadService();
    const project = await Project.findById(id);

    if (!project || project.company_id != companyId) {
      throw _404();
    }

    const oldFile = project.logo_url;
    const timestamp = Date.now();
    const filename = md5(`${project.id}-logo-${project.company_id}`) + `-${timestamp}`;
    const uploadedFile = await uploader.upload(req, res, 'project/logo', filename);
    const updated = await project.updateAttribute('logo_url', uploadedFile.key);

    if (oldFile) {
      try {
        await uploader.deleteFile(oldFile);
      } catch (err) {
        console.log('Error on delete file in S3');
      }
    }

    return updated;
  };

  Project.getSubmissionListFiles = (projectId, options, cb) => {
    const {ProjectSubmissionListContact, ProjectSubmissionListFiles, ProjectFile} = Project.app.models;
    (async _ => {
      try {
        const contactToken = options.headers[ProjectSubmissionListContact.CONTACT_TOKEN_HEADER];
        const contact = await ProjectSubmissionListContact.getByToken(contactToken);
        const {list_id} = contact;

        const files = await ProjectSubmissionListFiles.find({
          where: {list_id}
        }).map(async file => await ProjectFile.findById(file.file_id));

        return cb(null, files);
      } catch (err) {
        return cb(err);
      }
    })();
  };

  Project.remoteMethod('getSubmissionListFiles', {
    returns: {arg: 'data', type: 'object', root: true},
    http: {path: '/:id/submission-list-files', verb: 'get'},
    accepts: [
      {arg: 'id', type: 'number', required: true},
      {arg: 'options', type: 'object', required: true, http: {source: 'req'}},
    ],
  });
};
