const express = require('express')
const cors = require('cors')
const app = express()
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SEC);

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
        const ordersCollection = db.collection('orders');


        /////// Order APIs

        app.get('/orders', async (req, res) => {
            try {
                const { email } = req.query;
                let query = {};

                if (email) {
                    query.userEmail = email;
                }

                const orders = await ordersCollection.find(query).sort({ createdAt: -1 }).toArray();
                res.send(orders);
            } catch (error) {
                console.error(error);
                res.status(500).send({ success: false, message: "Server error" });
            }
        });

        app.get('/orders/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await ordersCollection.findOne(query)
            res.send(result)
        })


        app.post('/orders', async (req, res) => {
            const order = req.body;

            order.status = 'pending';
            order.paymentStatus = 'unpaid';
            order.userEmail = order.userEmail;
            order.createdAt = new Date();

            const result = await ordersCollection.insertOne(order);
            res.send(result);
        });

        app.delete('/orders/:id', async (req, res) => {
            const { id } = req.params;

            try {
                const result = await ordersCollection.deleteOne({ _id: new ObjectId(id) });
                res.send({ success: result.deletedCount > 0 });
            } catch (err) {
                console.error(err);
                res.status(500).send({ success: false, message: "Server error" });
            }
        });

        app.patch('/orders/:id/status', async (req, res) => {
            const { id } = req.params;
            const { status } = req.body;

            try {
                const result = await ordersCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status } }
                );
                res.send({ success: result.modifiedCount > 0 });
            } catch (err) {
                console.error(err);
                res.status(500).send({ success: false, message: "Server error" });
            }
        });

        app.patch('/orders/:id/cancel', async (req, res) => {
            const { id } = req.params;

            try {
                const result = await ordersCollection.updateOne(
                    { _id: new ObjectId(id), status: 'pending' },
                    { $set: { status: 'cancelled' } }
                );

                res.send({ success: result.modifiedCount > 0 });
            } catch (error) {
                console.error(error);
                res.status(500).send({ success: false, message: 'Server error' });
            }
        });






        //// Book Add APIs
        app.get('/books', async (req, res) => {

            const query = {}

            const { email } = req.query
            if (email) {
                query.email = email
            }
            else {
                query.status = 'published';
            }

            const books = (await booksCollection.find(query).sort({ createdAt: -1 }).toArray());
            res.send(books);
        })

        app.get('/books/latest', async (req, res) => {
            const books = await booksCollection
                .find({ status: 'published' })
                .sort({ createdAt: -1 })
                .limit(6)
                .toArray();
            res.send(books);
        });


        // Get a single book by ID
        app.get('/books/:id', async (req, res) => {
            const { id } = req.params;
            try {
                const book = await booksCollection.findOne({ _id: new ObjectId(id) });
                if (!book) {
                    return res.status(404).send({ success: false, message: "Book not found" });
                }
                res.send(book);
            } catch (err) {
                console.error(err);
                res.status(500).send({ success: false, message: "Server error" });
            }
        });



        app.post('/books', async (req, res) => {
            const book = req.body;

            book.createdAt = new Date()

            const result = await booksCollection.insertOne(book);
            res.send(result);
        });

        app.patch('/books/:id/status', async (req, res) => {
            const { id } = req.params;
            const { status } = req.body;

            const result = await booksCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { status } }
            );

            res.send({ success: result.modifiedCount > 0 });
        });

        // Update a book by ID
        app.patch('/books/:id', async (req, res) => {
            const { id } = req.params;
            const updatedData = req.body;

            try {
                const result = await booksCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updatedData }
                );

                if (result.modifiedCount > 0) {
                    res.send({ success: true, message: "Book updated successfully" });
                }
            } catch (err) {
                console.error(err);
                res.status(500).send({ success: false, message: "Server error" });
            }
        });


        ////// Payment APIs
        app.post('/create-checkout-session', async (req, res) => {
            try {
                const paymentInfo = req.body;

                const amount = parseInt(paymentInfo.price);

                const session = await stripe.checkout.sessions.create({
                    line_items: [
                        {
                            price_data: {
                                currency: 'usd',
                                unit_amount: amount,
                                product_data: {
                                    name: paymentInfo.bookName
                                }
                            },
                            quantity: 1,
                        },
                    ],
                    customer_email: paymentInfo.userEmail,
                    mode: 'payment',
                    metadata: {
                        orderId: paymentInfo.orderId,
                    },
                    success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
                    cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
                });

                res.send({ url: session.url });

            } catch (error) {
                console.error(error);
                res.status(500).send({ error: error.message });
            }
        });

        app.patch('/payment-success', async (req, res) => {
            const sessionId = req.query.session_id
            // console.log('sess id', sessionId)

            const session = await stripe.checkout.sessions.retrieve(sessionId)
            console.log('sess retr', session)

            // const transactionId = session.payment_intent
            // const query = { transactionId: transactionId }

            // const paymentExist = await paymentCollection.findOne(query)

            // if (paymentExist) {
            //     return res.send({ message: 'Already Exists', transactionId, trackingId: paymentExist.trackingId })
            // }

            // const trackingId = session.metadata.trackingId

            if (session.payment_status === 'paid') {
                const id = session.metadata.orderId
                const query = { _id: new ObjectId(id) }
                const update = {
                    $set: {
                        paymentStatus: 'paid',
                    }
                }
                const result = await ordersCollection.updateOne(query, update)
                res.send(result)
                const payment = {
                    amount: session.amount_total,
                    currency: session.currency,
                    customerEmail: session.customer_email,
                    orderId: session.metadata.orderId,
                    bookName: session.metadata.bookName,
                    transactionId: session.payment_intent,
                    paymentStatus: session.payment_status,
                    paidAt: new Date()
                }

                //     if (session.payment_status === 'paid') {
                //         const resultPayment = await paymentCollection.insertOne(payment)

                //         logTracking(trackingId, 'parcel_paid')

                //         res.send({ success: true, modifyParcel: result, paymentInfo: resultPayment, trackingId: trackingId, transactionId: session.payment_intent })
                //     }

            }
            res.send({ success: true })
        })


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