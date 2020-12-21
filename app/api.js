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
const { type } = require("os");
const { parse } = require("path");
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

async function mongoGetSms(q) {
  var result = {};
  try {
    const db = client.db("sms");
    const collection = db.collection("machines");
    result = await collection.find(q).toArray();
    await Promise.all(result.map(async (res) => {
      res.ownerData = (await mongoGetOwners({_id: ObjectID(res.ownerData)}))[0];
    }));
  } catch (e) {
    console.error(e);
  }
  return result;
}

async function mongoGetOwners(q) {
  var result = {};
  try {
    const db = client.db("sms");
    const collection = db.collection("owners");
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

async function mongoInsertOwner(data) {
  try {
    const db = client.db("sms"); 
    const collection = db.collection("owners");
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
    return true;
  } catch (e) {
    console.error(e);
    return false;
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
    return false;
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

router.post("/sms/search", async function(req, res){
  q = { };
  if(req.body && Object.entries(req.body).length > 0) {
    q = {
      $and: []
    };
    // search criteria
    if(req.body.brands) {
      brandsQ = {$or: []}
      for (const b of Object.keys(req.body.brands)) {
        if(req.body.brands[b])
          brandsQ['$or'].push(
          {
            brand: b
          }
          );
        }
      q['$and'].push(brandsQ);
    }
    if(req.body.years) {
      yearsQ = {$and: []}
      if(req.body.years['from'] && !isNaN(parseInt(req.body.years['from']))) {
        yearsQ['$and'].push( { year: {$gt: parseInt(req.body.years['from'])} } );
      }
      if(req.body.years['to']  && !isNaN(parseInt(req.body.years['to']))) {
        yearsQ['$and'].push( { year: {$lt: parseInt(req.body.years['to'])} });
      }
      q['$and'].push(yearsQ);
    }
  }
  res.send(await mongoGetSms(q));
});

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
  var ownerData = req.body.ownerData;
  if(ownerData && ownerData._id == null) {
    await mongoInsertOwner(ownerData);
  }
  // fixing the year to numeric value
  var machineData = req.body;
  if(machineData.year) {
    var yearNumb = parseInt(machineData.year);
    if(!isNaN(yearNumb))
      machineData.year = parseInt(machineData.year);
  }
  if(ownerData) {
    machineData.ownerData = ownerData._id;
  }
  res.send({ success: await mongoInsertSm(machineData) });
});

router.get("/sms", async function (req, res) {
  res.send(await mongoGetSms({}));
});

router.get("/owners", async function (req, res) {
  var q = {};
  if(req.query.q && typeof(req.query.q) == 'string') {
    q = {
      $or: [ {
              name: {
                  $regex: "/*" + req.query.q.toLowerCase() + "/*",
                  $options: "i"
              }
            }, {
              surname: {
                  $regex: "/*" + req.query.q.toLowerCase() + "/*",
                  $options: "i"
              }
          }]
    };
  }

  res.send(await mongoGetOwners(q));
});

// router.post("/owners", async function (req, res) {
//   res.send(await mongoGetOwners(req.body));
// });

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
