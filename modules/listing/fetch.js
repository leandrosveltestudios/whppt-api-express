const { isEmpty, toUpper, map, forEach, flattenDeep, uniq } = require('lodash');

module.exports = {
  exec({ $mongo: { $db } }, query) {
    const { categoryFilterId, filters, checkedCategories, limit = 6, currentPage = 1, hideTours } = query;

    const categoryQuery = {};
    const listingsQuery = {};
    const checkedCategoriesQuery = {};
    const toursQuery = {};

    if (filters && !isEmpty(filters)) listingsQuery['atdw.startDate'] = {};
    if (filters && filters.from) listingsQuery['atdw.startDate'].$gte = filters.from;
    if (filters && filters.to) listingsQuery['atdw.startDate'].$lte = filters.to;
    if (checkedCategories && checkedCategories.length) {
      checkedCategoriesQuery['taggedCategories.value'] = {};
      checkedCategoriesQuery['taggedCategories.value'].$in = map(checkedCategories, c => {
        return toUpper(c.trim());
      });
    }
    if (hideTours && hideTours !== 'undefined') {
      toursQuery.$or = [{ 'atdw.productCategoryId': { $ne: 'TOUR' } }, { listingType: { $ne: 'product' } }];
    }
    console.log('exec -> categoryFilterId', categoryFilterId);

    if (categoryFilterId && categoryFilterId !== 'none') {
      return $db
        .collection('categories')
        .findOne({ _id: categoryFilterId })
        .then(category => {
          categoryQuery.$and = [];
          forEach(category.filters, orFilter =>
            categoryQuery.$and.push({
              'taggedCategories.value': {
                $in: map(orFilter, or => {
                  return toUpper(or.trim());
                }),
              },
            })
          );

          const listingCategories = uniq(
            map(flattenDeep(category.filters), f => {
              return f.trim();
            })
          );

          const listings = $db.collection('listings').aggregate([
            { $match: { ...categoryQuery, ...listingsQuery, ...checkedCategoriesQuery, ...toursQuery } },
            { $lookup: { from: 'pages', localField: '_id', foreignField: '_id', as: 'page' } },
            { $lookup: { from: 'pages', localField: 'parentId', foreignField: '_id', as: 'parentPage' } },
            { $skip: limit * (currentPage - 1) },
            { $limit: limit },
            { $addFields: { slug: '$page.slug', parentSlug: '$parentPage.slug' } },
            // {$addFields: {slug: {$ifNull: ['$slug', '$parentSlug']}}},
            // {$addFields: {slug: {$ifNull: ['$parentPage.slug', '$page.slug']}}},
            // {$unwind: "$slug"},
            { $project: { page: 0, parentPage: 0 } },
          ]);
          const count = $db.collection('listings').find({ ...categoryQuery, ...listingsQuery, ...checkedCategoriesQuery, ...toursQuery });
          // .find({ ...categoryQuery, ...listingsQuery, ...checkedCategoriesQuery, ...toursQuery })
          // .skip(limit * (currentPage - 1))
          // .limit(limit);

          return Promise.all([listings.toArray(), count.count()]).then(([listings, totalListings]) => {
            return { listings, totalListings, listingCategories };
          });
        })
        .catch(err => {
          console.error(err);
          throw err;
        });
    } else {
      const listings = $db.collection('listings').aggregate([
        { $match: { ...listingsQuery, ...toursQuery } },
        { $lookup: { from: 'pages', localField: '_id', foreignField: '_id', as: 'page' } },
        { $lookup: { from: 'pages', localField: 'parentId', foreignField: '_id', as: 'parentPage' } },
        { $skip: limit * (currentPage - 1) },
        { $limit: limit },
        { $addFields: { slug: '$page.slug', parentSlug: '$parentPage.slug' } },
        // {$addFields: {slug: {$ifNull: ['$slug', '$parentSlug']}}},
        // {$addFields: {slug: {$ifNull: ['$parentPage.slug', '$page.slug']}}},
        // {$unwind: "$slug"},
        { $project: { page: 0, parentPage: 0 } },
      ]);

      const count = $db.collection('listings').find({ ...listingsQuery, ...toursQuery });
      // .find({ ...listingsQuery, ...toursQuery })
      // .skip(limit * (currentPage - 1))
      // .limit(limit);

      return Promise.all([listings.toArray(), count.count()]).then(([listings, totalListings]) => {
        return { listings, totalListings };
      });
    }
  },
};
