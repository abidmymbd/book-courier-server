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
        const paymentCollection = db.collection('payments');
        const usersCollection = db.collection('users');
        const reviewsCollection = db.collection('reviews');



        // ////// users APIs
        app.post('/users', async (req, res) => {
            const user = req.body;
            user.role = 'user'
            user.createdAt = new Date()

            const existingUser = await usersCollection.findOne({ email: user.email });
            if (existingUser) {
                return res.send({ message: 'User already exists' });
            }

            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        app.get('/users', async (req, res) => {
            const users = await usersCollection.find().toArray();
            res.send(users);
        });

        // Get single user by email
        app.get('/users/role/:email', async (req, res) => {
            const email = req.params.email;
            const user = await usersCollection.findOne({ email });
            res.send(user);
        });


        // Update user role (admin / librarian)
        app.patch('/users/:id/role', async (req, res) => {
            const { id } = req.params;
            const { role } = req.body;

            try {
                const result = await usersCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { role } }
                );

                res.send({
                    success: result.modifiedCount > 0
                });
            } catch (error) {
                console.error(error);
                res.status(500).send({ success: false });
            }
        });




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

        // Delete a book by ID
        app.delete('/books/:id', async (req, res) => {
            const { id } = req.params;
            try {
                const result = await booksCollection.deleteOne({ _id: new ObjectId(id) });
                res.send({ success: result.deletedCount > 0 });
            } catch (err) {
                console.error(err);
                res.status(500).send({ success: false, message: "Server error" });
            }
        });

        app.get('/all-books', async (req, res) => {
            try {
                const books = await booksCollection.find({}).sort({ createdAt: -1 }).toArray();
                res.send(books);
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
                        bookName: paymentInfo.bookName
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
            try {
                const sessionId = req.query.session_id;
                const session = await stripe.checkout.sessions.retrieve(sessionId);

                if (session.payment_status !== 'paid') {
                    return res.send({ success: false });
                }

                const transactionId = session.payment_intent;


                const existingPayment = await paymentCollection.findOne({ transactionId });
                if (existingPayment) {
                    return res.send({
                        success: true,
                        message: 'Payment already processed',
                        transactionId
                    });
                }

                // Update order ONLY ONCE
                await ordersCollection.updateOne(
                    {
                        _id: new ObjectId(session.metadata.orderId),
                        paymentStatus: { $ne: 'paid' }
                    },
                    {
                        $set: {
                            paymentStatus: 'paid',
                            paidAt: new Date()
                        }
                    }
                );

                const payment = {
                    amount: session.amount_total,
                    currency: session.currency,
                    customerEmail: session.customer_email,
                    orderId: session.metadata.orderId,
                    bookName: session.metadata.bookName,
                    transactionId,
                    paymentStatus: session.payment_status,
                    paidAt: new Date()
                };

                await paymentCollection.insertOne(payment);

                res.send({ success: true, transactionId });

            } catch (error) {
                console.error(error);
                res.status(500).send({ success: false });
            }
        });




        // ///////// payment APIs
        app.get('/payments', async (req, res) => {
            try {
                const { email } = req.query;
                const query = email ? { customerEmail: email } : {};
                const payments = await paymentCollection
                    .find(query)
                    .sort({ paidAt: -1 })
                    .toArray();

                res.send(payments);
            } catch (error) {
                console.error(error);
                res.status(500).send({ success: false, message: 'Server error' });
            }
        });


        ////// Reviews APIs
        app.post('/reviews', async (req, res) => {
            const review = req.body;
            review.createdAt = new Date();

            try {
                const hasOrdered = await ordersCollection.findOne({
                    bookId: review.bookId,
                    userEmail: review.userEmail
                });
                if (!hasOrdered) return res.status(403).send({ success: false, message: 'You cannot review without ordering' });

                const result = await reviewsCollection.insertOne(review);
                res.send(result);
            } catch (err) {
                console.error(err);
                res.status(500).send({ success: false, message: 'Server error' });
            }
        });

        app.get('/reviews', async (req, res) => {
            const { bookId } = req.query;
            if (!bookId) return res.status(400).send({ success: false, message: 'bookId required' });

            try {
                const reviews = await reviewsCollection.find({ bookId }).sort({ createdAt: -1 }).toArray();
                res.send(reviews);
            } catch (err) {
                console.error(err);
                res.status(500).send({ success: false, message: 'Server error' });
            }
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