const express = require('express');
const cors = require('cors');

const usersRoutes = require('./routes/users.routes');
const sessionsRoutes = require('./routes/sessions.routes');
const videoGamesRoutes = require('./routes/video-games.routes');
const genresRoutes = require('./routes/genres.routes');
const tagsRoutes = require('./routes/tags.routes');
const achievementsRoutes = require('./routes/achievements.routes');
const reviewsRoutes = require('./routes/reviews.routes');
const progressRoutes = require('./routes/progress.routes');
const {
    router: purchasesRoutes,
    byUser: purchasesByUserRoutes
} = require('./routes/purchases.routes');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
    res.status(200).json({
        ok: true,
        message: 'API de GameVault funcionando'
    });
});

app.use('/api/users', usersRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/users/:id/purchases', purchasesByUserRoutes);
app.use('/api/users/:id/achievements', progressRoutes);
app.use('/api/video-games', videoGamesRoutes);
app.use('/api/genres', genresRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api/purchases', purchasesRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/achievements', achievementsRoutes);

const swaggerUi = require('swagger-ui-express');
const openapi = require('./docs/openapi.json');
app.get('/openapi.json', (req, res) => res.json(openapi));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi, {
    explorer: true,
    customSiteTitle: 'GameVault | Swagger API'
}));



const path = require('path');
app.use(express.static(path.join(__dirname, '..', 'public')));

const notFoundHandler = require('./middleware/not-found');
const errorHandler = require('./middleware/error-handler');

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
