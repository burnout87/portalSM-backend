const bodyParser = require("body-parser");
var express = require("express");
var router = express.Router();
const cors = require("cors");
const multer = require('multer');
const {MongoClient, ObjectID} = require("mongodb");
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

router.use(express.static('public'));

var allowedOrigins = ['http://localhost:4200'];

router.use(cors({ 
  credentials: true, 
  origin: function(origin, callback){
    // allow requests with no origin (like mobile apps or curl requests)
    if(!origin) return callback(null, true);
    if(allowedOrigins.indexOf(origin) === -1){
      var msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: 'GET,POST,DELETE' }));

// mongodb
const config = require("../.env.json");
const uri = config.mongo.uri;
const client = new MongoClient(uri);

client.connect();

const DIR = './uploads';
const storage = multer.diskStorage({
  destination: (req, res, cb) => {
    cb(null, DIR)
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({storage: storage});

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
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

async function mongoRemoveSm(id) {
  try {
    const db = client.db("sms"); 
    const collection = db.collection("machines");
    await collection.deleteOne({_id: ObjectID(id)});
    return 1;
  } catch (e) {
    console.error(e);
    return -1;
  }
}

async function authenticate(password) {
  try {
    const db = client.db("sms"); 
    const collection = db.collection("authentication");
    resultAuth = await collection.findOne({'password': {$exists: true}});
    await bcrypt.compare(password , resultAuth.password);
    return true;
  } catch (e) {
    console.error(e);
    return -1;
  }
}

async function updatePass(password) {
  try {
    const hash = await bcrypt.hash(password, 10);
    const db = client.db("sms"); 
    const collection = db.collection("authentication");
    await collection.deleteMany({});
    await collection.insertOne({password: hash});
    return 1;
  } catch (e) {
    console.error(e);
    return -1;
  }
}

router.post("/sms", upload.array('images'), async function (req, res) {
  if (req.files) {
    req.body.images = [];
    req.files.forEach(file => {
      var dataBuf = fs.readFileSync(file.path);
      req.body.images.push({
        data: dataBuf,
        path: file.path,
        type: file.mimetype
      });
    })
  }
  res.send({ success: await mongoInsertSm(req.body) });
});

router.get("/sms", async function (req, res) {
  res.send(await mongoGetSm(req.body));
});

router.delete("/sms/:id", async function (req, res) {
  if(req.params.id)
    res.send({ state: await mongoRemoveSm(req.params.id)});
});

router.post("/sms/login", async function (req, res) {
  if (req.body.password) {
    res.send({ state: await authenticate(req.body.password)});
  } else {
    res.send({ state: 'wrong request'});
  }
});

router.post("/sms/updatePass", async function (req, res) {
  if (req.body.password) {
    res.send({ state: await updatePass(req.body.password)});
  } else {
    res.send({ state: 'wrong request'});
  }
});

module.exports = router;
