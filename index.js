const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hq6na.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// const uri = `mongodb+srv://assignment12:tktwS882WEO1VZBQ@cluster0.hq6na.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection

    const BioDataCollection = client.db('LifeLinkDB').collection('biodata');
    const BioDetailsCollection = client.db('LifeLinkDB').collection('details');
    const userCollection = client.db('LifeLinkDB').collection('users');

    //biodata related 
    app.get('/biodata', async (req, res) => {
      const result = await BioDataCollection.find().toArray();
      res.send(result)
    })
    app.get('/biodata/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await BioDataCollection.findOne(query);
      res.send(result);
    })

    // BioDetails related 
    app.get('/favorites', async (req, res) => {
      const email = req.query.email;
      const query = { email: email }
      const result = await BioDetailsCollection.find(query).toArray();
      res.send(result)
    })
    app.delete('/favorites/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await BioDetailsCollection.deleteOne(query);
      res.send(result);
  })

    app.post('/favorites', async (req, res) => {
      const favoritesDetails = req.body;
      const result = await BioDetailsCollection.insertOne(favoritesDetails);
      res.send(result);
    })




    //user related 
    app.post('/users', async (req, res) => {
      const user = req.body;

      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ massage: 'user already exists', insertedId: null })
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    })



    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('New final project running now.')
})

app.listen(port, () => {
  console.log(`New final project running on port:${port}`)
})