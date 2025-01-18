const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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

    //payment related 
    app.post('/create-payment-intent', async (req, res) => {
      try {
        const { amount } = req.body; // Amount in cents

        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency: 'usd',
          payment_method_types: ['card'],
        });

        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Payment intent creation failed' });
      }
    });

    app.post('/record-payment', async (req, res) => {
      try {
        const paymentDetails = req.body;
        const paymentCollection = client.db('LifeLinkDB').collection('payments');

        const result = await paymentCollection.insertOne(paymentDetails);

        res.send({ success: true, result });
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Failed to record payment' });
      }
    });
    app.get('/payments', async (req, res) => {
      try {
        const email = req.query.email; // Query parameter থেকে ইমেইল নেওয়া
        const paymentCollection = client.db('LifeLinkDB').collection('payments');

        let query = {};
        if (email) {
          query = { email }; // ইমেইল যদি দেওয়া থাকে, তাহলে ফিল্টার করব
        }

        const payments = await paymentCollection.find(query).toArray(); // ডেটা লোড
        res.send(payments);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Failed to fetch payment data' });
      }
    });

    app.delete('/payments/:id', async (req, res) => {
      try {
        const id = req.params.id; // URL থেকে আইডি পাওয়া
        const paymentCollection = client.db('LifeLinkDB').collection('payments');

        const result = await paymentCollection.deleteOne({ _id: new ObjectId(id) }); // MongoDB ObjectId ব্যবহার করা
        if (result.deletedCount === 1) {
          res.send({ success: true, message: 'Payment deleted successfully' });
        } else {
          res.status(404).send({ success: false, message: 'Payment not found' });
        }
      } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, error: 'Failed to delete payment' });
      }
    });

    // app.patch('/payments/:id', async (req, res) => {
    //   try {
    //     const id = req.params.id;
    //     const paymentCollection = client.db('LifeLinkDB').collection('payments');

    //     // Update the status to "Approved"
    //     const filter = { _id: new ObjectId(id) };
    //     const updateDoc = { $set: { status: "Approved" } };
    //     const result = await paymentCollection.updateOne(filter, updateDoc);

    //     if (result.modifiedCount > 0) {
    //       res.send({ success: true, message: "Status updated to Approved" });
    //     } else {
    //       res.send({ success: false, message: "No changes made" });
    //     }
    //   } catch (error) {
    //     console.error("Error updating status:", error);
    //     res.status(500).send({ success: false, message: "Internal Server Error" });
    //   }
    // });

    app.patch('/payments/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const status = req.body.status || "Premium"; // Default status to "Approved"
        const collections = [
          client.db('LifeLinkDB').collection('payments'),
          client.db('LifeLinkDB').collection('biodata'),
          client.db('LifeLinkDB').collection('favorites'),
        ];

        let updates = [];

        for (const collection of collections) {
          const filter = { _id: new ObjectId(id) };
          const updateDoc = { $set: { status } };
          const result = await collection.updateOne(filter, updateDoc);

          // Collect the result for reporting
          updates.push({ collectionName: collection.collectionName, modifiedCount: result.modifiedCount });
        }

        // Check if any updates were made
        const totalModified = updates.reduce((sum, item) => sum + item.modifiedCount, 0);

        if (totalModified > 0) {
          res.send({
            success: true,
            message: `Status updated to ${status} in ${totalModified} document(s).`,
            updates,
          });
        } else {
          res.send({
            success: false,
            message: "No matching documents found in any collection.",
            updates,
          });
        }
      } catch (error) {
        console.error("Error updating status:", error);
        res.status(500).send({ success: false, message: "Internal Server Error" });
      }
    });



    // --------------------------

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


    //admin details 
    app.get("/dashboard", async (req, res) => {
      try {
        // Query counts and revenue
        const totalBiodataCount = await BioDataCollection.countDocuments();
        const maleBiodataCount = await BioDataCollection.countDocuments({ type: "Male" });
        const femaleBiodataCount = await BioDataCollection.countDocuments({ type: "Female" });
        const premiumBiodataCount = await BioDataCollection.countDocuments({ status: "Premium" });

        const totalRevenue = await userCollection.aggregate([
          { $match: { paymentStatus: "Completed" } }, // Filter only completed payments
          { $group: { _id: null, totalRevenue: { $sum: "$amount" } } },
        ]).toArray();

        // Prepare response
        const dashboardData = {
          totalBiodataCount,
          maleBiodataCount,
          femaleBiodataCount,
          premiumBiodataCount,
          totalRevenue: totalRevenue[0]?.totalRevenue || 0,
        };

        res.status(200).json(dashboardData);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        res.status(500).json({ error: "Failed to fetch dashboard data." });
      }
    });



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