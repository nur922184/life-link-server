const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken')
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



    // medile ware


    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ massage: 'forbidden access' })
      }
      next();

    }


    const verifyToken = (req, res, next) => {
      // console.log('inside verify token', req.headers.authorization)
      if (!req.headers.authorization) {
        return res.status(401).send({ massage: 'unauthorized access' })
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ massage: 'unauthorized access' })
        }
        req.decoded = decoded;
        next()
      })
    }


    //jwt related api 

    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '2h' });
      res.send({ token })
    })


    //biodata related 
    app.get('/biodata', async (req, res) => {
      const result = await BioDataCollection.find().toArray();
      res.send(result)
    })
   
    app.post('/biodata', async (req, res) => {
      const item = req.body
      const result = await BioDataCollection.insertOne(item);
      res.send(result)
  })

  app.get('/biodata/:email', async (req, res) => {
    const email = req.params.email; // URL থেকে ইমেইল প্যারামিটার গ্রহণ করা
    try {
      const biodata = await BioDataCollection.findOne({ email }); // MongoDB থেকে ইমেইল দিয়ে ডাটা খোঁজা
      if (biodata) {
        res.status(200).json(biodata); // ডাটা পাঠানো
      } else {
        res.status(404).json({ message: 'No biodata found for this email.' }); // যদি ডাটা না পাওয়া যায়
      }
    } catch (error) {
      res.status(500).json({ message: 'Internal Server Error', error }); // সার্ভার এরর হ্যান্ডলিং
    }
  });
  



    app.get('/biodata/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await BioDataCollection.findOne(query);
      res.send(result);
    })

    // BioDetails related 
    app.get('/favorites', verifyToken, async (req, res) => {
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
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      // console.log(req.headers)
      const result = await userCollection.find().toArray();
      res.send(result)
    })

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

    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { role: 'admin' },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      // Ensure the email matches the decoded token
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden access' });
      }

      // Query the database to check the user role
      const query = { email: email };
      const user = await userCollection.findOne(query);

      // Determine if the user is an admin
      const admin = user?.role === "admin";

      // Respond with admin status
      res.send({ admin });
    });



    app.patch('/users/premium/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { role: 'premium' },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query);
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