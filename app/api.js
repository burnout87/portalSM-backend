const bodyParser = require("body-parser");
var express = require("express");
var router = express.Router();
const cors = require("cors");
const { MongoClient } = require("mongodb");

router.use(cors());
router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

// mongodb
const config = require("../.env.json");
// default uri "mongodb://localhost:27017/test?retryWrites=true&w=majority&useUnifiedTopology=true"
const uri = config.mongo.uri;
const client = new MongoClient(uri);

router.use(bodyParser.json());

client.connect();

async function mongoGetSm(q) {
  var result = {};
  try {
    const db = client.db("sms");
    const collection = db.collection("machines");
    result = await collection.find(q).toArray();
  } catch (e) {
    console.error(e);
  }
  return result;
}

async function mongoInsertSm(data) {
  try {
    const db = client.db("sms");
    const collection = db.collection("machines");
    await collection.insertOne(data);
    return 1;
  } catch (e) {
    console.error(e);
    return -1;
  }
}

router.post("/sms/add/", cors(), async function (req, res) {
  res.send({ state: await mongoInsertSm(req.body) });
});

router.get("/sms", cors(), async function (req, res) {
  res.send({ state: await mongoGetSm(req.body) });
});

router.options("/sms/add/", cors(), function (req, res, next) {
  console.log(req);
  console.log(res);
});

module.exports = router;
