'use strict';

module.exports = (app) => {
  const {Role, ProjectSubmissionListContact, ProjectSubmissionList, Project} = app.models;

  const _getContactToken = context => {
    if (!context ||
      !context.remotingContext ||
      !context.remotingContext.req ||
      !context.remotingContext.req.headers
    ) {
      return null;
    }

    return context.remotingContext.req.headers[ProjectSubmissionListContact.CONTACT_TOKEN_HEADER] || null;
  };

  const _isContactTokenTtlValid = contact => {
    if (!contact.token_ttl || !contact.sent_at) {
      return false;
    }

    const now = Date.now();
    const startTime = contact.sent_at.getTime();
    const elapsedSeconds = (now - startTime) / 1000;
    const secondsToLive = contact.token_ttl;

    return secondsToLive === -1 || elapsedSeconds < secondsToLive;
  };

  const findContact = async context => {
    const token = _getContactToken(context);

    if (!token) {
      return null;
    }

    const contact = await ProjectSubmissionListContact.getByToken(token);

    if (!contact || contact.token !== token || !_isContactTokenTtlValid(contact)) {
      return null;
    }

    return contact;
  };

  Role.registerResolver('projectSubmissionListContact', async (role, context, cb) => {
    const projectListContact = await findContact(context);

    if (!projectListContact || context.modelName !== 'project' || !context.modelId) {
      return false;
    }

    const projectSubmissionList = await ProjectSubmissionList.findById(projectListContact.list_id);
    const project = await Project.findById(context.modelId);

    return projectSubmissionList.project_id && projectSubmissionList.project_id === project.id;
  });
};
