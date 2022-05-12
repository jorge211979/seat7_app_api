'use strict';

module.exports = function(BasePersistedModel) {
  const _findSkipProperties = (modelProperties, skipAttributeName) => {
    const skipProperties = [];
    for (const propertyName in modelProperties) {
      const propertyDefinition = modelProperties[propertyName];
      if (true === propertyDefinition[skipAttributeName]) {
        skipProperties.push(propertyName);
      }
    }

    return skipProperties;
  };

  BasePersistedModel.skipAttributes = (ctx) => {
    const skipAttributeName = `skip${ctx.isNewInstance ? 'Create' : 'Update'}`;
    const modelProperties = ctx.Model.definition.properties;
    const skipProperties = _findSkipProperties(modelProperties, skipAttributeName);

    if (ctx.instance) {
      skipProperties.forEach(propertyName => ctx.instance.unsetAttribute(propertyName));
    } else {
      skipProperties.forEach(propertyName => delete ctx.data[propertyName]);
    }
  };

  BasePersistedModel.observe('before save', async (ctx) => {
    BasePersistedModel.skipAttributes(ctx);
    return;
  });
};
