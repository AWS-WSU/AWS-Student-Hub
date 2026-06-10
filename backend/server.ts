import app from './app';

const PORT = Number(process.env.PORT || 5001);

app.listen(PORT, () => {
  console.log(`server: listening on http://localhost:${PORT}.`);
  console.log(`server: api available at http://localhost:${PORT}/api.`);
});
