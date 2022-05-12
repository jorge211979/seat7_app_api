'use strict';

module.exports = (app) => {
  const company = app.models.company;
  company.nestRemoting('projects');
};
