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




    // medile ware-
    //-------------------------




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

    // --------------------------

    app.get('/contact-requests', verifyToken, async (req, res) => {
      try {
        const email = req.decoded.email; // Ensure the user is authenticated
        if (!email) {
          return res.status(400).send({ message: 'User email is required' });
        }

        const query = { userEmail: email }; // Match the logged-in user's email
        const contactRequests = await BioDetailsCollection.find(query).toArray(); // Replace with your collection name
        res.status(200).send(contactRequests);
      } catch (error) {
        console.error('Error fetching contact requests:', error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });

    app.delete('/contact-requests/:id', verifyToken, async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: 'Invalid request ID' });
        }

        const query = { _id: new ObjectId(id) }; // MongoDB ID format
        const result = await BioDetailsCollection.deleteOne(query);

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: 'Contact request not found' });
        }

        res.status(200).send({ message: 'Contact request deleted successfully' });
      } catch (error) {
        console.error('Error deleting contact request:', error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });












    // --------------------------

    app.get('/biodata', async (req, res) => {
      const email = req.query.email;

      // যদি `email` থাকে, ফিল্টার করুন। না থাকলে সব ডাটা রিটার্ন করুন।
      const query = email ? { contactEmail: email } : {};

      const result = await BioDataCollection.find(query).toArray();
      res.send(result);
    });

    app.patch('/biodata/:id', async (req, res) => {
      const { id } = req.params;
      const updates = req.body;

      try {
        const result = await BioDataCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updates }
        );

        if (result.modifiedCount > 0) {
          res.status(200).send({ message: 'Biodata updated successfully' });
        } else {
          res.status(400).send({ error: 'No changes made or update failed' });
        }
      } catch (error) {
        res.status(500).send({ error: 'Server error' });
      }
    });




    app.post('/biodata', async (req, res) => {
      const item = req.body
      const result = await BioDataCollection.insertOne(item);
      res.send(result)
    })





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