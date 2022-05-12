'use strict';

const md5 = require('md5');
const UploadService = require('../services/upload.js');

module.exports = function(ProjectBanner) {
  ProjectBanner.observe('before delete', function(ctx, next) {
    (async _ => {
      const {instance} = ctx;

      if (!instance || !instance.image_url) {
      }

      const uploader = new UploadService();
      try {
        await uploader.deleteFile(instance.image_url);
      } catch (err) {}
      next();
    })();
  });

  const _updateOrCreateBanner = (projectId, data) => {
    return new Promise((resolve, reject) => {
      ProjectBanner.findOrCreate({
        where: {
          'project_id': projectId,
        },
      }, {
        'project_id': projectId,
      }, async (err, banner) => {
        if (err) {
          return reject(err);
        }

        delete data.project_id;

        await banner.updateAttributes(data);
        return resolve(banner);
      });
    });
  };

  ProjectBanner.uploadBanner = async (project, req, res) => {
    const uploader = new UploadService();
    const banner = await ProjectBanner.findOne({
      where: {
        'project_id': project.id,
      },
    });
    const oldFile = banner.image_url;
    const timestamp = Date.now();
    const filename = md5(`${project.id}-banner-${project.company_id}`) + `-${timestamp}`;
    const uploadedFile = await uploader.upload(req, res, 'project/banner', filename);

    if (oldFile) {
      try {
        await uploader.deleteFile(oldFile);
      } catch (err) {
        console.log('Error on delete file in S3');
      }
    }

    return _updateOrCreateBanner(project.id, {
      'image_url': uploadedFile.key,
    });
  };

  ProjectBanner.upsertData = (project, bannerData) => {
    if (!Object.keys(bannerData).length) {
      throw new Error('Update data is empty');
    }

    delete bannerData.image_url;
    delete bannerData.project_id;

    return _updateOrCreateBanner(project.id, bannerData);
  };

  ProjectBanner.deleteFile = async (project) => {
    const banner = await ProjectBanner.findOne({
      where: {
        'project_id': project.id,
      },
    });

    if (banner && banner.image_url) {
      const uploader = new UploadService();

      try {
        await uploader.deleteFile(banner.image_url);
      } catch (err) {}

      return _updateOrCreateBanner(project.id, {
        'image_url': null,
      });
    }

    return Promise.resolve(banner);
  };
};
