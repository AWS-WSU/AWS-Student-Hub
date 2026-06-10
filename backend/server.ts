import app from './app';

const PORT = Number(process.env.PORT || 5001);

app.listen(PORT, () => {
  console.log(`server running on port ${PORT}.`);
  console.log(`api available at http://localhost:${PORT}.`);
});
