define(function (require) {
  var _ = require('lodash');

  var module = require('modules').get('kibana/services');
  var configCats = require('./_config_categories');


  module.factory('AdhocVis', function (courier, Private) {
    var aggs = Private(require('./_aggs'));


    /**
      opts params:
      {
        type: 'histogram', // The chart type
        listeners : {
          onClick: function,
          onHover: function,
          onBrush: function,
        },
        params: {}, // top level chart parameters
        searchSource: SearchSource // the search source for the visualization
      }

    */
    function AdhocVis(opts) {
      var vis = this;
      var params;

      // Must get an object for this one
      if (typeof opts !== 'object') return;

      vis.typeName = opts.type || 'histogram';
      vis.params = _.cloneDeep(opts.params);
      vis.searchSource = opts.searchSource || courier.SavedObject.rootSearch();

      // give this the properties of config
      _.merge(vis, opts.config);

      // also give it the on* interaction functions, if any
      _.merge(vis, opts.listeners);

      // TODO: Should we abtract out the agg building stuff?
      vis.searchSource
        // reads the vis' config and write the agg to the searchSource
        .aggs(function () {
          // stores the config objects in queryDsl
          var dsl = {};
          // counter to ensure unique agg names
          var i = 0;
          // start at the root, but the current will move
          var current = dsl;

          // continue to nest the aggs under each other
          // writes to the dsl object
          vis.getConfig().forEach(function (config) {
            current.aggs = {};
            var key = '_agg_' + (i++);

            var aggDsl = {};
            aggDsl[config.agg] = config.aggParams;

            current = current.aggs[key] = aggDsl;
          });

          // set the dsl to the searchSource
          return dsl.aggs || {};
        });

      // TODO: Should this be abstracted somewhere? Its a copy/paste from _saved_vis.js
      vis._fillConfigsToMinimum = function () {
        // satify the min count for each category
        configCats.fetchOrder.forEach(function (category) {
          var myCat = vis[category.name];

          if (myCat.configs.length < myCat.min) {
            _.times(myCat.min - myCat.configs.length, function () {
              vis.addConfig(category.name);
            });
          }
        });
      };

      vis._fillConfigsToMinimum();

      // Need these, but we have nothing to destroy for now;
      vis.destroy = function () {};

      /**
       * Create a list of config objects, which are ready to be turned into aggregations,
       * in the order which they should be executed.
       *
       * @return {Array} - The list of config objects
       */
      vis.getConfig = Private(require('./_read_config'));

      /**
       * Transform an ES Response into data for this visualization
       * @param  {object} resp The elasticsearch response
       * @return {array} An array of flattened response rows
       */
      vis.buildChartDataFromResponse = Private(require('./_build_chart_data'));

    }

    return AdhocVis;
  });
});