'use strict';

const loopback = require("loopback");
const path = require('path');

module.exports = function(Mailer) {

  const TEMPLATES_PATH = path.resolve(__dirname, `../../common/views/email_templates/`);

  Mailer.getTemplatePath = file => path.resolve(__dirname, `${TEMPLATES_PATH}/${file}.ejs`);

  Mailer.sendEmail = (customConfig, callback) => {
    const config = {
      from: 'Seat 7 Entertainment <gamedev@seat7entertainment.com>',
      ...customConfig
    };

    return Mailer.send(config, callback);
  };

  Mailer.renderTemplate = (templatePath, contentModel) => {
    const renderer = loopback.template(templatePath);
    return renderer(contentModel);
  };
};
