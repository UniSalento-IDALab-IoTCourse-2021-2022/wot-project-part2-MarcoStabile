const express = require('express');
const bodyParser = require('body-parser');
const MongoClient = require('mongodb').MongoClient;
const http = require('http');
const cors = require('cors');
const WebSocket = require('ws');
const WEBSOCKET_PORT = 3001; // Websocket server port
const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = 'mongodb+srv://marcostabile:owjKu3pHvsmJ97Dl@iotapp.gbcfxjx.mongodb.net/?retryWrites=true&w=majority';
const client = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
const db = client.db('Patients');

app.use(bodyParser.json());
app.use(cors());

// Create a simple HTTP server for WebSocket communication
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// WebSocket handling
wss.on('connection', (socket) => {
    console.log('WebSocket connected');
});

// Create an object to link mac_address to patient
const macAddressToPatient = {
    "D7:DA:5D:26:87:08": "Marco",
    "E2:CB:C3:5C:C1:9A": "Luca",
    "D8:F1:CA:B2:7A:04": "Francesco"
};

// Function to send anomaly alert to all connected clients
function broadcastAnomalyAlert(anomalyData) {
    const payload = JSON.stringify({ type: 'anomaly', data: anomalyData });
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            console.log(payload);
            client.send(payload);
        }
    });
}

server.listen(WEBSOCKET_PORT, () => {
    console.log(`WebSocket Server is running on port ${WEBSOCKET_PORT}`);
});

// Function to find the latest status for a patient in any room
async function findLatestStatus(db, patient) {
    const collection = db.collection('Location');

    const result = await collection
        .find({ patient })
        .sort({ timestamp: -1 }) // Sort by timestamp in descending order to get the latest record first
        .limit(1) // Limit to the first result (latest record)
        .toArray();

    return result[0]; // Return the latest status or null if not found
}

// Function to find the latest "found" status for a patient in any room
async function findLatestKnownLocation(db, patient) {
    const collection = db.collection('Location');

    const result = await collection
        .find({ patient, status: "found" })
        .sort({ timestamp: -1 }) // Sort by timestamp in descending order to get the latest record first
        .limit(1) // Limit to the first result (latest record)
        .toArray();

    return result[0]; // Return the latest found status or null if not found
}

// API endpoint to receive location updates from Raspberry Pi devices
app.post('/api/update_location', async (req, res) => {
    const { mac_address, location, patient, status } = req.body;

    try {
        const client = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        await client.connect();
        const db = client.db('Patients');
        // Store data in MongoDB
        const collection = db.collection('Location');
        const timestamp = new Date();

        const result = await collection.insertOne({
            mac_address,
            location,
            patient,
            status,
            timestamp
        });

        console.log(`Inserted document with _id: ${result.insertedId}`);
        res.status(200).send('Location updated successfully');

        // If the status is "not found," perform the query to find the latest status "found"
        if (status === "not found") {
            const foundStatus = await findLatestKnownLocation(db, patient);
            const currentStatus = await findLatestStatus(db,patient)
            console.log(`Current status: ${currentStatus.status}`)
            if (foundStatus) {
                console.log(`Patient ${patient} latest known location wan in  ${foundStatus.location} at ${foundStatus.timestamp}.`);
                // Perform further actions or logging here
            }
        }

    } catch (error) {
        console.error(`Error inserting data into MongoDB: ${error}`);
        res.status(500).send('Internal Server Error');
    }
});

// API endpoint to handle the case when no devices are found
app.post('/api/no_devices_found', (req, res) => {
    const { message, location } = req.body;

    console.log(`No devices found: ${message}, Location: ${location}`);

    // Perform actions based on the message or location (customize as needed)
    // For example, send an alert, notification, or perform other relevant tasks

    res.status(200).send('No devices found notification received');
});

// API endpoint to receive messages from the client
app.post('/api/receiveMessage', (req, res) => {
    const { message } = req.body;
    console.log(`Received message from client: ${message}`);
    res.status(200).send('Message received successfully');
});

// API endpoint to receive anomaly updates from Raspberry Pi devices
app.post('/api/update_anomaly', async (req, res) => {
    const { mac_address,patient, anomaly_type, value } = req.body;
    const timestamp = new Date();

    try {
        const client = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        await client.connect();
        const db = client.db('Patients');
        // Store data in MongoDB
        const collection = db.collection('Anomalies');


        const result = await collection.insertOne({
            mac_address,
            patient,
            anomaly_type,
            value,
            timestamp
        });

        console.log(`Inserted document with _id: ${result.insertedId}`);
        res.status(200).send('Location updated successfully');
    } catch (error) {
        console.error(`Error inserting data into MongoDB: ${error}`);
        res.status(500).send('Internal Server Error');
    }

    console.log(`Received anomaly update for ${mac_address}: ${anomaly_type} - ${value}`);

    const where = await findLatestKnownLocation(db, patient);
    const location = where ? where.location : null;

    // Broadcast the anomaly alert to all connected clients
    broadcastAnomalyAlert({
        mac_address,
        patient,
        location,
        anomaly_type,
        value,
        timestamp,
    });

    /*switch (anomaly_type) {
        case 'temperature':
            if (value > 38.0) {
                const alertMessage = `High temperature alert for ${patient}: ${value}`;
                res.json(alertMessage)
                // Implement actions for high temperature alert (e.g., send notification)
            }
            break;
        case 'bpm':
            if (value < 60 || value > 100) {
                const alertMessage = `Abnormal BPM alert for ${mac_address}: ${value}`;
                res.json(alertMessage)
                // Implement actions for abnormal BPM alert (e.g., send notification)
            }
            break;
        case 'fall_detection':
            if (value === true) {
                const alertMessage = `Fall detected for ${mac_address}`;
                res.json(alertMessage)
                // Implement actions for fall detection (e.g., send emergency alert)
            }
            break;
        // Add additional cases for other anomaly types if needed
    }*/

    // Perform actions based on the type of anomaly (example: send alert, notification, etc.)
    //handleAnomalyActions(patient, mac_address, anomaly_type, value);
});

// Function to find the latest "found" status for a patient in any room
async function findLatestPosition(db, mac_address) {
    const collection = db.collection('Location');

    const result = await collection
        .find({ mac_address, status: "found" })
        .sort({ timestamp: -1 }) // Sort by timestamp in descending order to get the latest record first
        .limit(1) // Limit to the first result (latest record)
        .toArray();

    return result[0] ? { location: result[0].location, timestamp: result[0].timestamp } : null;
}


// API endpoint to retrieve patient latest position
app.get('/api/get_latest_position', async (req, res) => {
    const { mac_address } = req.query;
    console.log(mac_address)

    try {
        const client = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        await client.connect();
        const db = client.db('Patients');
        const latestPosition = await findLatestPosition(db, mac_address);
        res.json({ latestPosition });
    } catch (error) {
        console.error(`Error fetching latest position data: ${error.message}`);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// Add this route handler to your existing server-side code
app.get('/api/get_patientData', async (req, res) => {
    try {
        const client = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        await client.connect();
        const db = client.db('Patients');
        const collection = db.collection('Patients');
        const patients = await collection.find().toArray();
        // Close the MongoDB connection
        client.close();
        res.json(patients);
    } catch (error) {
        console.error(`Error fetching patient data: ${error.message}`);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});


// Function to handle actions based on the type of anomaly
function handleAnomalyActions(socket, patient, mac_address, anomaly_type, value) {
    // Example: Send alert or notification based on anomaly type
    switch (anomaly_type) {
        case 'temperature':
            if (value > 38.0) {
                const alertMessage = `High temperature alert for ${patient}: ${value}`;
                socket.send(JSON.stringify({ type: 'anomaly', data: alertMessage }));
                // Implement actions for high temperature alert (e.g., send notification)
            }
            break;
        case 'bpm':
            if (value < 60 || value > 100) {
                const alertMessage =`Abnormal BPM alert for ${mac_address}: ${value}`;
                socket.send(JSON.stringify({ type: 'anomaly', data: alertMessage }));
                // Implement actions for abnormal BPM alert (e.g., send notification)
            }
            break;
        case 'fall_detection':
            if (value === true) {
                const alertMessage =`Fall detected for ${mac_address}`;
                socket.send(JSON.stringify({ type: 'anomaly', data: alertMessage }));
                // Implement actions for fall detection (e.g., send emergency alert)
            }
            break;
        // Add additional cases for other anomaly types if needed
    }
}

// Define a function to find the latest anomaly for a given mac_address
async function findLatestAnomaly(db, mac_address) {
    const collection = db.collection('Anomalies');

    const result = await collection
        .find({ mac_address })
        .sort({ timestamp: -1 }) // Sort by timestamp in descending order to get the latest record first
        .limit(1) // Limit to the first result (latest record)
        .toArray();

    console.log(result)

    return result[0]; // Return the latest anomaly or null if not found
}

// Define the API endpoint to retrieve the latest anomaly
app.get('/api/get_latest_anomaly', async (req, res) => {
    const { mac_address } = req.query;
    const patient = macAddressToPatient[mac_address];

    try {
        const client = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        await client.connect();
        const db = client.db('Patients'); // Replace 'YourDBName' with your actual database name

        const latestAnomaly = await findLatestAnomaly(db, mac_address);
        const where = await findLatestKnownLocation(db, patient);
        const location = where ? where.location : null;

        const data = {
            patient,
            location,
            anomaly_type: latestAnomaly ? latestAnomaly.anomaly_type : null,
            value: latestAnomaly ? latestAnomaly.value : null,
            timestamp: latestAnomaly ? latestAnomaly.timestamp : null,
        };

        if (latestAnomaly) {
            res.json(data);
        } else {
            res.status(404).json({ message: 'No anomalies found for the specified mac_address.' });
        }

        // Close the MongoDB connection
        client.close();
    } catch (error) {
        console.error(`Error fetching latest anomaly data: ${error.message}`);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// API endpoint to add a new patient
app.post('/api/addPatient', async (req, res) => {
    const newPatient = req.body;

    try {
        const collection = db.collection('Patients');

        /* Check if the patient with the given MAC address already exists
        const existingPatient = await collection.findOne({ macAddress });
        if (existingPatient) {
            return res.status(400).json({ message: 'Patient with this MAC address already exists.' });
        } */
        await collection.insertOne(newPatient);
        console.log('New Patient:', newPatient);

        res.status(200).json({ message: 'Patient added successfully.' });
    } catch (error) {
        console.error(`Error adding patient: ${error.message}`);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// API endpoint to retrieve MAC address to patient mapping
app.get('/api/get_mac_address_mapping', async (req, res) => {
    try {

        const collection = db.collection('Patients');
        const patients = await collection.find().toArray();

        const mapping = {};
        patients.forEach(patient => {
            mapping[patient.mac_address] = patient.Name; // Use 'Name' instead of 'name'
        });

        console.log('Server Response:', mapping);

        res.json(mapping);
    } catch (error) {
        console.error(`Error fetching MAC address mapping: ${error.message}`);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// Endpoint to get all medicine reminders
app.get('/api/get-reminders', async (req, res) => {
    try {
        const client = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        await client.connect();
        const db = client.db('Patients');
        const collection = db.collection('Reminders');

        const reminders = await collection.find().toArray();

        res.json(reminders);
    } catch (error) {
        console.error('Error getting medicine reminders:', error.message);
        res.status(500).send('Internal Server Error');
    }
});

// HISTORY LOG OF ALL ANOMALIES

app.get('/api/getAnomalyHistory', async (req, res) => {
    const { filter } = req.query;
    let filterCondition = {};

    if (filter === 'today') {
        // Add filter condition for today
        filterCondition = {
            timestamp: { $gte: new Date().setHours(0, 0, 0, 0) },
        };
    } else if (filter === 'yesterday') {
        // Add filter condition for yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        filterCondition = {
            timestamp: { $gte: yesterday.setHours(0, 0, 0, 0), $lt: new Date().setHours(0, 0, 0, 0) },
        };
    }

    try {
        const collection = db.collection('Anomalies');
        const anomalyHistory = await collection.find(filterCondition).toArray();

        res.json(anomalyHistory);
    } catch (error) {
        console.error(`Error fetching anomaly history: ${error.message}`);
        res.status(500).json({ message: 'Internal server error.' });
    }
});
