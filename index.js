const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const admin = require("firebase-admin");
const serviceAccount = require("./serviceKey.json");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 3000;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

//server sider
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.garcytk.mongodb.net/?appName=Cluster0`;

// midleware
app.use(cors());
app.use(express.json());

const verifyToken = async (req, res, next) => {
  const authorization = req.headers.authorization;

  const token = authorization.split(" ")[1];

  if (!token) {
    return res
      .status(402)
      .send({ message: "unauthorized access. TOken not Found " });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    console.log(decodedToken);
    next();
  } catch (error) {
    console.log("firebase veryfiy erorrrrrrrr", error.message);
    res.status(401).send({ message: "Unauthorized Access" });
  }
};

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("ecotrack is working!");
  next();
});

async function run() {
  try {
    await client.connect();
    // database name and collection name
    const db = client.db("ecotrackDB");
    const usersColllection = db.collection("users");
    const tipsCollection = db.collection("tips");
    const eventsCollection = db.collection("upComingEvent");
    const challengesCollection = db.collection("challenges");
    const userChallengeCollection = db.collection("userChallenges");
    const liveStaticsCollection = db.collection("liveStatics");

    // live statics
    app.get("/api/livestatics", async (req, res) => {
      const result = await liveStaticsCollection.find().toArray();
      res.send(result);
    });
    //challenges api
    app.get("/api/livestatics", async (req, res) => {
      const result = await liveStaticsCollection.find().toArray();
      res.send(result);
    });

    // my activitis challange api
    app.get("/api/challenges/join", async (req, res) => {
      const email = req.query.email;
      try {
        const joined = await userChallengeCollection
          .find({ userId: email })
          .toArray();
        const challengeDetails = await Promise.all(
          joined.map(async (item) => {
            const challenge = await challengesCollection.findOne({
              _id: new ObjectId(item.challengeId),
            });
            return {
              ...item,
              title: challenge?.title,
              category: challenge?.category,
              imageUrl: challenge?.imageUrl,
              duration: challenge?.duration,
              impactMetric: challenge?.impactMetric,
            };
          })
        );
        res.send(challengeDetails);
      } catch (error) {
        res.status(500).send({ message: "Failed to load user activities" });
      }
    });

    // userChallenge join api
    app.post("/api/challenges/join", verifyToken, async (req, res) => {
      const data = req.body;
      const alreadyJoined = await userChallengeCollection.findOne({
        userId: req.use.email,
        challengeId: data.challengeId,
      });
      if (alreadyJoined) {
        return res
          .status(400)
          .send({ message: "You already joined this challenge" });
      }
      const joinedChallenge = {
        ...data,
        startDate: new Date(),
        progress: 0,
      };
      const result = await userChallengeCollection.insertOne(joinedChallenge);
      const filter = { _id: new ObjectId(data.challengeId) };
      const update = {
        $inc: { participants: 1 },
      };
      await challengesCollection.updateOne(filter, update);
      res.send({ result });
    });
    //challenges api
    app.get("/api/challenges", async (req, res) => {
      const result = await challengesCollection.find().toArray();
      res.send(result);
    });

    // challenges details api
    app.get("/api/challenges/:id", async (req, res) => {
      const { id } = req.params;
      const result = await challengesCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });
    // users api
    app.post("/user", async (req, res) => {
      const body = req.body;
      const result = await usersColllection.insertOne(body);
      res.send(result);
    });

    // delete challenge api
    app.delete("/api/challenges/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const userEmail = req.user.email;
      try {
        const challange = await challengesCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!challange) {
          return res.status(404).send({ message: "challenge not found" });
        }

        if (challange.ownerEmail !== userEmail) {
          return res
            .status(403)
            .send({ message: "unauthorized: you are not the owner" });
        }

        const result = await challengesCollection.deleteOne({
          _id: new ObjectId(id),
        });

        await userChallengeCollection.deleteMany({
          challengeId: id,
        });

        res.send({ deletedCount: result.deletedCount });
      } catch (error) {
        res.status(500).send({ message: "Failed to delete challenge" });
      }
    });

    // activechallengescard api
    app.get("/api/activechallenges", async (req, res) => {
      const today = new Date();

      const challenges = await challengesCollection.find().toArray();
      const active = challenges.filter((item) => {
        const start = new Date(item.startDate);
        const end = new Date(item.endDate);
        return start <= today && end >= today;
      });
      res.status(200).send(active.slice(0, 6));
    });

    // Recent Tips Api
    app.get("/api/tips", async (req, res) => {
      const result = await tipsCollection.find().toArray();
      res.send(result);
    });

    // Upcoming Event Api
    app.get("/api/upComingEvents", async (req, res) => {
      const result = await eventsCollection.find().toArray();
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } catch (error) {
    console.log("MongoDB Connenction failed", error);
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
