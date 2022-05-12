'use strict';

module.exports = function(Publisher) {
  // https://stackoverflow.com/a/48717843
  // https://strongloop.com/strongblog/working-with-pagination-and-loopback/
  // Publisher.beforeRemote('*', function(ctx, instance, next) {
  //   console.log('ss before remote hook', ctx);
  //   // if (!ctx.args.filter || !ctx.args.filter.limit) {
  //   //   console.log('ss forcing limit!');
  //   //   if (!ctx.args.filter) ctx.args.filter = {};
  //   //   ctx.args.filter.limit = 10;
  //   // }
  //   next();
  // });
};
