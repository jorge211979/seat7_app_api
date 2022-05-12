'use strict';

const aws = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');

module.exports = class UploadService {
  constructor() {
    this._loadS3();
  }

  _loadS3Config() {
    const appRoot = process.cwd();
    const env = process.env.NODE_ENV;

    const configFiles = {
      production: `${appRoot}/server/config-s3.production.json`,
      test: `${appRoot}/server/config-s3.test.json`,
      default: `${appRoot}/server/config-s3.json`,
    };

    this.s3Config = require(configFiles[env] || configFiles.default);

    return this.s3Config;
  }

  _loadS3() {
    const s3Config = this._loadS3Config();
    aws.config.update(s3Config);

    this.s3 = new aws.S3();
  }

  _extensionFromMime(mimetype) {
    const mimeExtensions = {
      'image/jpg': 'jpg',
      'image/jpeg': 'jpg',
      'image/png': 'png',
    };

    return mimeExtensions[mimetype] || null;
  }

  upload(
    request, response, folder, filename, acl = 'public-read'
  ) {
    const upload = multer({
      fileFilter: (req, file, cb) => {
        // todo: extension validation
        // console.log(file);
        cb(null, true);
      },
      storage: multerS3({
        s3: this.s3,
        bucket: this.s3Config.uploadsBucket,
        acl: acl,
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => {
          // console.log(file);
          const extension = this._extensionFromMime(file.mimetype);
          // file structure
          // { fieldname: 'file',
          //   originalname: 'Grupo de máscara 231.jpg',
          //   encoding: '7bit',
          //   mimetype: 'image/jpeg'
          // }
          cb(null, `${folder}/${filename}.${extension}`);
        },
      }),
    }).single('file');

    return new Promise((resolve, reject) => {
      upload(request, response, (err) => {
        if (err) {
          return reject(err);
        }

        if (!request.file) {
          const err = new Error('Missing mandatory file');
          err.statusCode = 400;
          return reject(err);
        }

        // Everything went fine.
        return resolve(request.file);
      });
    });
  }

  async deleteFile(path) {
    const params = {
      Bucket: this.s3Config.uploadsBucket,
      Key: path,
    };

    const result = await this.s3.deleteObject(params).promise();

    return result;
  }
};
