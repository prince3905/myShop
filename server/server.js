const mongoose = require('mongoose');
require("dotenv").config();
const app = require("./app");

const port = process.env.PORT;
const URL = process.env.MONGO_URI

mongoose
  .connect(URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('DB Connected successfully'))
  .catch((err) => console.error(err));

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
