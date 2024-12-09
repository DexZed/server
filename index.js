const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const dotenv = require("dotenv");
require("dotenv").config();
const { applicationDefault } = require("firebase-admin/app");

// const { fileURLToPath } = require("url");
// const path = require("path");

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// dotenv.config({ path: path.resolve(__dirname, "./.env") });
// const uname = process.env.USER_NAME;
// const pass = process.env.PASS_WORD;

const firebaseConfigBase64 = process.env.FIREBASE_CREDENTIALS || '';
const firebaseConfig = JSON.parse(Buffer.from(firebaseConfigBase64, 'base64').toString('utf-8'));
const appAdmin = admin.initializeApp({
    credential: admin.credential.cert(firebaseConfig),
  });


try {
    const apps = admin.apps;
    console.log("Firebase apps initialized:", apps.map((app) => app?.name));
  } catch (error) {
    console.error("Error fetching Firebase apps:", error);
  }
  


const app = express();
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.PASS_WORD}@cluster0.1xqqb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (_req, res) => {
  const response = "Hello World!";
  res.send(response);
});

async function run() {
  const database = client.db("tulip");
  const campaignsCollection = database.collection("campaigns");
  const peopleCollection = database.collection("people");
  const donations = database.collection("donations");


    // Define GET enpoint for to get all campaigns from the campaign collection
app.get("/campaigns/:limit", async (req, res) => {
    try {
      const limit = req.params.limit;
      const campaigns = await campaignsCollection.find().limit(Number(limit)).toArray();
      res.json(campaigns);
    } catch (error) {
      console.error("Failed to fetch campaigns", error);
      res.status(500).send("Failed to fetch campaigns");
    }
  });
  // Define GET endpoint to get all users from people collection
  
  app.get("/people", async (req, res) => {
    try {
      const people = await peopleCollection.find().toArray();
      res.json(people);
    } catch (error) {
      console.error("Failed to fetch people", error);
      res.status(500).send("Failed to fetch people");
    }
  });
  
  // Define POST endpoint to create a new campaign in the campaign collection by a user 
  app.post("/campaigns/addcampaign", async (req, res) => {
    try {
      const newCampaign = req.body;
      const result = await campaignsCollection.insertOne(newCampaign);
      res.status(201).json({ message: "Campaign created successfully", id: result.insertedId });
    } catch (error) {
      console.error("Failed to create campaign", error);
      res.status(500).send("Failed to create campaign");
    }
    });
  
    // Define GET endpoint for specific campaign
    app.get("/campaign/:id", async (req, res) => {
      const { id } = req.params; // Use 'id' to match the route definition
      try {
        const campaign = await campaignsCollection.findOne({ _id: new ObjectId(id) });
        res.status(200).json(campaign);
      } catch (error) {
        console.error("Failed to fetch specific campaigns", error);
        res.status(404).send("Campaign not found");
      }
    });
  
    // Define POST request to add donations to the donations collections
    app.post("/donations", async (req, res) => {
      try {
        const newDonation = req.body;
    
     
        const result = await donations.insertOne(newDonation);
        res.status(201).json({ 
          message: "Donation created successfully", 
          id: result.insertedId 
        });
      } catch (error) {
        console.error("Failed to create donation", error);
        res.status(500).json({ message: "Failed to create donation" });
      }
    });
  
    // Define GET endpoint for user specific campaigns
  app.get("/mycampaigns/:userId", async (req, res) => {
    const { userId } = req.params; // Get the userId from the URL
    try {
      const userCampaigns = await campaignsCollection.find({ userId }).toArray();
      res.status(200).json(userCampaigns);
    } catch (error) {
      console.error("Failed to fetch user-specific campaigns", error);
      res.status(500).send("Failed to fetch campaigns");
    }
  });
  
  // Define GET endpoint to fetch user-specific donations from donations collection
  app.get("/mydonations/:userId", async (req, res) =>
    {
      const { userId } = req.params; // Get the userId from the URL
      try {
        const userDonations = await donations.find({ userId }).toArray();
        res.status(200).json(userDonations);
      } catch (error) {
        console.error("Failed to fetch user-specific donations", error);
        res.status(500).send("Failed to fetch donations");
      }
    });
  
  // Define DELETE endpoint to delete user-specific campaigns
  app.delete("/deletecampaigns/:campaignId", async (req, res) => {
    const { campaignId } = req.params;
  
    // Validate the campaignId format before proceeding
    if (!ObjectId.isValid(campaignId)) {
      return res.status(400).json({ message: "Invalid campaign ID format" });
    }
  
    const idToken = req.headers.authorization?.split(" ")[1]; // Extract the token
    if (!idToken) {
      return res.status(401).json({ message: "Unauthorized: Missing token" });
    }
  
    let userId;
    try {
      const decodedToken = await appAdmin.auth().verifyIdToken(idToken); 
      userId = decodedToken.uid; 
    } catch (error) {
      return res.status(401).json({ message: "Invalid token" });
    }
  
    try {
      const result = await campaignsCollection.deleteOne({
        _id: new ObjectId(campaignId), // Convert campaignId to ObjectId
        userId: userId // Ensure the user is authorized to delete this campaign
      });
  
      if (result.deletedCount === 0) {
        return res.status(404).json({ message: "Campaign not found or unauthorized" });
      }
  
      res.status(200).json({ message: "Campaign deleted successfully" });
    } catch (error) {
      console.error("Error deleting campaign:", error);
      res.status(500).send("Failed to delete campaign");
    }
  });
  
  // Define PATCH endpoint to update campaign fields by authenticated user
  app.patch("/updatecampaigns/:campaignId", async (req, res) => {
    const { campaignId } = req.params;
    const updatedFields = req.body;
    // Uncomment when Firebase auth is set up
    const idToken = req.headers.authorization?.split(" ")[1]; // Extract the token
    if (!idToken) {
      return res.status(401).json({ message: "Unauthorized: Missing token" });
    }
  
    let userId;
    try {
      const decodedToken = await appAdmin.auth().verifyIdToken(idToken); // Verify Firebase token
      userId = decodedToken.uid; // Get the authenticated user's ID
    } catch (error) {
      return res.status(401).json({ message: "Invalid token" });
    }
  
    try {
      const result = await campaignsCollection.updateOne(
        { _id: new ObjectId(campaignId), userId },
        { $set: updatedFields }
      );
  
      if (result.modifiedCount === 0) {
        return res.status(404).json({ message: "Campaign not found or unauthorized" });
      }
  
      res.status(200).json({ message: "Campaign updated successfully" });
    } catch (error) {
      console.error("Error updating campaign:", error);
      res.status(500).json({ message: "Failed to update campaign" });
    }
  });
  
  



}
run().catch(console.dir);
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
module.exports = app;