const app = require('./api/index');

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Stalker-to-M3U running at http://localhost:${port}`);
});
