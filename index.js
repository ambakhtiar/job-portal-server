const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// Middleware 
app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const logger = (req, res, next) => {
    console.log('Logger function');
    next();
}

const verifyToken = (req, res, next) => {
    const token = req?.cookies?.token;
    console.log('Token ', token);

    if (!token) {
        console.log('--------1');
        return res.status(401).send({ message: 'unauthorized access' });
    }

    jwt.verify(token, process.env.JET_SECRET, (err, decoded) => {
        if (err) {
            console.log('..........2');
            return res.status(401).send({ message: 'unauthorized access' });
        }
        req.user = decoded;
        next();
    })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zflfj9t.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");


        const jobCollection = client.db('jobPortal').collection('jobs');
        const jobApplicationCollection = client.db('jobPortal').collection('job_application');

        // Auth related api 
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.JET_SECRET, { expiresIn: '6h' });
            res.cookie('token', token, {
                httpOnly: true,
                secure: false // http://localhost:5000/signIn 
            }).send({ success: true });
        })

        // Job realted api 
        app.get('/jobs', async (req, res) => {
            const email = req.query.email;
            let query = {};
            if (email) {
                query = { hr_email: email }
            }
            const cursor = jobCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/jobs/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await jobCollection.findOne(query);
            res.send(result);
        })

        app.post('/jobs', async (req, res) => {
            const newJob = req.body;
            const result = await jobCollection.insertOne(newJob);
            res.send(result);
        })


        // Job application related 
        app.get('/job-application', verifyToken, async (req, res) => {
            console.log('Cookies ', req.cookies);
            const email = req.query.email;
            let query = { applicant_email: email };

            // JWT part
            if (req.user.email !== req.query.email) {
                return res.status(403).send({ message: 'Forbidden acess' });
            }

            // if (email) {
            //     const query = { applicant_email: email };
            // }
            const result = await jobApplicationCollection.find(query).toArray();
            for (application of result) {
                // console.log(application.job_id);
                const query1 = { _id: new ObjectId(application.job_id) };
                const job = await jobCollection.findOne(query1);
                if (job) {
                    application.title = job.title;
                    application.company = job.company;
                    application.location = job.location;
                    application.category = job.category;
                    application.jobType = job.jobType;
                    application.company_logo = job.company_logo;
                }
            }
            res.send(result);
        })

        app.get('/job-application/jobs/:job_id', async (req, res) => {
            const id = req.params.job_id;
            const query = { job_id: id };
            const result = await jobApplicationCollection.find(query).toArray();
            res.send(result);
        })

        app.post('/job-application', async (req, res) => {
            const application = req.body;
            const result = await jobApplicationCollection.insertOne(application);

            // This is not best way (use aggregate)
            const id = application.job_id;
            const query = { _id: new ObjectId(id) };
            const job = await jobCollection.findOne(query);
            let newCount = 0;
            if (job.applicationCount) {
                newCount = job.applicationCount + 1;
            } else {
                newCount = 1;
            }
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    applicationCount: newCount
                }
            }
            const updateResult = jobCollection.updateOne(filter, updateDoc);

            res.send(result);
        })

        app.patch('/job-application/:id', async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: data.status
                }
            }
            const result = await jobApplicationCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Job portal server running......')
})

app.listen(port, () => {
    console.log(`Server running on ${port}`);
})