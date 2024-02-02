**Neurodegenerative Diseases: Patient Monitoring System with Anomaly Detection**

LINKS : 
https://github.com/UniSalento-IDALab-IoTCourse-2021-2022/wot-project-part1-MarcoStabile
https://github.com/UniSalento-IDALab-IoTCourse-2021-2022/wot-project-part3-MarcoStabile

**SECOND PART: SERVER SIDE**

This is an Internet of Things (IoT) application designed to monitor and manage patient well-being through a combination of BLE beacon scanning and wearable device anomaly detection.
Wearable device anomaly detection is not the main focus of this educational project, that is the beacon detection.
The project leverages the Web of Things (WoT) paradigm to enhance device interoperability and create a real-time monitoring system.

In healthcare environments, timely and accurate information is crucial for ensuring patient safety. 
The project employs a Raspberry Pi as an edge device to scan for BLE beacons in the surroundings and communicate with a wearable device worn by the patient. 
The wearable device is equipped with sensors to monitor vital signs and detect anomalies such as falls. Seen that the main focus is the detection , anomalies and all the 
sensors data are simulated.

<img width="434" alt="image" src="https://github.com/UniSalento-IDALab-IoTCourse-2021-2022/wot-project-part2-MarcoStabile/assets/105797309/f73a6953-e0de-447f-8afb-135274968bf0">

To set up and run the project, follow the step-by-step guide below.

*(Node and npm are required)*

First run the server with command:

node Server.js

Now the server will listen on port 3000 for the Raspberry Pi to update location of each patient and to update anomaly events.
All of this data will by stored by the server in a MongoDB insatnce in a Db called 'Patients'.
Also the code inside Server.js provide several methods to retrieve information from the database.
On port 3001 a webSocket is open to communicate with the web dashboard and send alert in case of emergencies.

Server prints useful information on console log.
