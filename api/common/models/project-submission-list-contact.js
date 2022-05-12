'use strict';

module.exports = function(ProjectSubmissionListContact) {
  ProjectSubmissionListContact.validatesInclusionOf('contact_type', {
    in: ['publisher', 'publisher_employee', 'press_contact'],
  });

  ProjectSubmissionListContact.CONTACT_TOKEN_HEADER = 'x-project-list-contact';

  ProjectSubmissionListContact.getByToken = token => {
    return ProjectSubmissionListContact.findOne({
      where: {token},
    });
  };

  ProjectSubmissionListContact.getContactFromTypeModel = async contact => {
    const {Publisher, PublisherEmployee, CompanyPressContact} = ProjectSubmissionListContact.app.models;
    const modelMap = {
      publisher: Publisher,
      publisher_employee: PublisherEmployee,
      press_contact: CompanyPressContact,
    };

    if (!modelMap[contact.contact_type]) {
      return null;
    }

    return await modelMap[contact.contact_type].findById(contact.contact_id);
  };
};
