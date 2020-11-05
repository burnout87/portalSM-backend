const bodyParser = require("body-parser");
var express = require("express");
// const fileUpload = require('express-fileupload');
var router = express.Router();
const cors = require("cors");
const multer = require('multer');
const {MongoClient, ObjectID} = require("mongodb");
const fs = require('fs');
const path = require('path');

// router.use(cors());
router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

// router.use(upload.array());
router.use(express.static('public'));

router.use(cors({ credentials: true, origin: 'http://localhost:4200' }));

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
    return 1;
  } catch (e) {
    console.error(e);
    return -1;
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

router.post("/sms/add/", upload.array('images'), async function (req, res) {
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
  // new_img.img.contentType = 'image/x-png,image/gif,image/jpeg';
  // new_img.save();
  res.send({ state: await mongoInsertSm(req.body) });
});

router.get("/sms", async function (req, res) {
  res.send(await mongoGetSm(req.body));
});

router.delete("/sms/add/:id", async function (req, res) {
  if(req.params.id)
    res.send({ state: await mongoRemoveSm(req.params.id)});
})

router.options("/sms/add/", cors());

module.exports = router;
