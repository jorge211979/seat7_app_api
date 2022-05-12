'use strict';

module.exports = (app) => {
  const {Role, UserCompany, Project} = app.models;

  const _isCompanyMember = async (companyId, userId) => {
    try {
      if (!userId || !companyId) {
        return false;
      }

      const count = await UserCompany.count({
        'company_id': companyId,
        'user_id': userId,
      });

      return count === 1;
    } catch (err) {
      throw err;
    }
  };

  const companyModelResolver = async (userId, context) => {
    if (!context.modelId) {
      return false;
    }

    const companyId = context.modelId;

    return await _isCompanyMember(companyId, userId);
  };

  const submissionListModelResolver = async (userId, context) => {
    let projectId;
    if (context.modelId) {
      const submissionList = await context.model.findById(context.modelId);

      projectId = submissionList ? submissionList.project_id : null;
    } else if (!context.modelId && context.method === 'create') {
      projectId = context.remotingContext.req.param('project_id') || null;
    }

    if (
      context.method === 'patchAttributes' &&
      context.remotingContext.req.param('project_id') != projectId
    ) {
      return false;
    }

    if (projectId) {
      const project = await Project.findById(projectId);

      if (project) {
        if (
          ['__create__contacts', '__updateById__contacts'].includes(context.method) &&
          'press_contact' !== context.remotingContext.req.param('contact_type')
        ) {
          // company users can only insert press_contact
          return false;
        }

        return await _isCompanyMember(project.company_id, userId);
      }
    }

    return false;
  };

  Role.registerResolver('company', async (role, context, cb) => {
    const modelResolvers = {
      company: companyModelResolver,
      project_submission_list: submissionListModelResolver,
    };

    if (
      !context ||
      !context.accessToken ||
      !context.accessToken.userId ||
      typeof modelResolvers[context.modelName] === 'undefined'
    ) {
      return false;
    }

    try {
      return await modelResolvers[context.modelName](context.accessToken.userId, context);
    } catch (err) {
      console.log('############# Company Role resolver error #############', err);
      return false;
    }
  });
};
