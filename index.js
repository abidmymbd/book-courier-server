const express = require('express')
const cors = require('cors')
const app = express()
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');

const port = process.env.PORT || 3000


// middleware
app.use(express.json())
app.use(cors())

////////// MongoDB Setup //////////
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@abid-first-curd.xb64eac.mongodb.net/?appName=ABID-FIRST-CURD`

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
////////// MongoDB Setup Done //////////

async function run() {
    try {
        // Connect the client to the server
        await client.connect();

        const db = client.db('book_courier_db')
        const booksCollection = db.collection('books')


        //// Book Add APIs
        app.get('/books', async (req, res) => {
            const books = await booksCollection.find().toArray();
            res.send(books);
        })

        app.post('/books', async (req, res) => {
            const book = req.body;
            const result = await booksCollection.insertOne(book);
            res.send(result);
        });





        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Book Courier is shifting!')
})

app.listen(port, () => {
    console.log(`Example Book Courier is listening on port ${port}`)
})