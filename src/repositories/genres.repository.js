const { createCatalogRepository } = require('./catalog.repository');

module.exports = createCatalogRepository({
    table: 'genres',
    primaryKey: 'genre_id',
    usageTable: 'video_game_genres',
    usageField: 'video_game_count'
});
