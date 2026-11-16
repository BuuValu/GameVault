const { createCatalogRepository } = require('./catalog.repository');

module.exports = createCatalogRepository({
    table: 'tags',
    primaryKey: 'tag_id',
    usageTable: 'review_tags',
    usageField: 'review_count'
});
