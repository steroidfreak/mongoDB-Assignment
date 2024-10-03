// SETUP BEGINS
const express = require("express");
const cors = require("cors");
const hbs = require("hbs");
const { ObjectId } = require('mongodb');

//enable express to read .env files
require("dotenv").config();
const MongoClient = require("mongodb").MongoClient;
const dbname = "mmtc_database";
const mongoUri = process.env.MONGO_URI;
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// function to generate an access token
function generateAccessToken(id, email) {
    // set the payload of the JWT (i.e, developers can add any data they want)
    let payload = {
        'user_id': id,
        'email': email,
    }

    // create the JWT
    // jwt.sign()
    // - parameter 1: the payload (sometimes known as 'claims')
    // - parameter 2: token secret,
    // - parameter 3: options (to set expiresIn)
    let token = jwt.sign(payload, process.env.TOKEN_SECRET, {
        'expiresIn':'1h' // h for hour, d for days, m is for minutes and s is for seconds
    });

    return token;
}

// middleware: a function that executes before a route function
function verifyToken(req,res, next) {
    // get the JWT from the headers
    let authHeader = req.headers['authorization'];
    let token = null;
    if (authHeader) {
        // the token will be stored as in the header as:
        // BEARER <JWT TOKEN>
        token = authHeader.split(' ')[1];
        if (token) {
            // the callback function in the third parameter will be called after
            // the token has been verified
            jwt.verify(token, process.env.TOKEN_SECRET, function(err,payload){
                if (err) {
                    console.error(err);
                    return res.sendStatus(403);
                }
                // save the payload into the request
                req.user = payload;
                // call the next middleware or the route function
                next();
                
            })
        } else {
            return res.sendStatus(403);
        }
    } else {
        return res.sendStatus(403);
    }
}

let app = express();

app.set("view engine","hbs");

app.use(express.static("public"));

app.use(express.urlencoded());

// !! Enable processing JSON data
app.use(express.json());

// !! Enable CORS
app.use(cors());

async function connect(uri, dbname) {
    let client = await MongoClient.connect(uri, {
        useUnifiedTopology: true
    })
    _db = client.db(dbname);
    return _db;
}

// Function to generate invoices
function generateInvoices(startDate, months, salary) {
    const invoices = [];
    
    // Array of month names in short form
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // Loop through the number of months
    for (let i = 0; i < months; i++) {
        // Clone the start date to avoid modifying the original date
        let invoiceDate = new Date(startDate);
        
        // Add i months to the start date
        invoiceDate.setMonth(invoiceDate.getMonth() + i);
        
        // Extract day, month, and year
        const day = invoiceDate.getDate();
        const month = monthNames[invoiceDate.getMonth()];
        const year = invoiceDate.getFullYear();
        
        // Format the invoice date as "DD Mon YYYY"
        const formattedDate = `${day} ${month} ${year}`;
        
        // Create the invoice object
        const invoice = {
            title: "Loan Fee",
            date: formattedDate,
            salary: salary
        };
        
        // Add the invoice to the invoices array
        invoices.push(invoice);
    }
    
    return invoices;
}

// Function to generate today date in dd mmm yyyy format which mmm is in alphabets
function generateTodayDate(){
    // Create a new Date object
    const today = new Date();

    // Array of month names in short form
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // Get the current day, month, and year
    const day = today.getDate();
    const month = monthNames[today.getMonth()]; // Get month as short form
    const year = today.getFullYear();

   // Format the date as DD/Mon/YYYY
    const formattedDate = `${day} ${month} ${year}`;

    return formattedDate;

}

// SETUP END
async function main() {
    const db = await connect(mongoUri, dbname);

    // Routes

    app.get('/hbs', function(req,res){
        // res.send can be used to send back HTML
        res.render("index");
    })

    app.get("/employers",verifyToken, async function (req, res) {
        try {

            // this is the same as let tags = req.query.tags etc. etc.
            // syntax: object destructuring
            let { name, ic, contact_number, email_address, physical_address } = req.query;

            let criteria = {};

            if (name) {
                criteria["name"] = {
                    "$regex": name, "$options": "i"
                }
            }

            if (ic) {
                criteria["ic"] = {
                    "$regex": ic, "$options": "i"
                }
            }
            if (contact_number) {
                criteria["contact_number"] = {
                    "$regex": contact_number, "$options": "i"
                }
            }
            if (email_address) {
                criteria["email_address"] = {
                    "$regex": email_address, "$options": "i"
                }
            }
            if (physical_address) {
                criteria["physical_address"] = {
                    "$regex": physical_address, "$options": "i"
                }
            }
            

            // mongo shell: db.recipes.find({},{name:1, cuisine:1, tags:1, prepTime:1})
            let employers = await db.collection("employers").find(criteria)
                .project({
                    "name": 1,
                    "ic": 1,
                    "contact_number": 1,
                    "email_address": 1,
                    "physical_address": 1
                }).toArray();
            res.json({
                'employers': employers
            })
        } catch (error) {
            console.error("Error fetching employers:", error);
            res.status(500);
        }
    })

    app.get("/employers/:id", async function (req,res){
        try {
            const id = req.params.id;
            
            // First, fetch the recipe
            const employer = await db.collection("employers").findOne(
                { _id: new ObjectId(id) },
                { projection: { 
                    name:1,
                    ic:1,
                    contact_number:1,
                    email_address:1,
                    physical_address:1

                } 
                }
            );
            
            if (!employer) {
                return res.status(404).json({ error: "employer not found" });
            }
            
        

            
            res.json(employer);
        } catch (error) {
            console.error("Error fetching employer:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    app.post("/employers", async function(req,res){


        try {
            const{name, ic, phone_number, email_address, physical_address} = req.body;
            if(!name || !ic || !phone_number || !physical_address){
                return res.status(400).json({
                    error : "Missing required fields"
                })
            }
            //create new employer
            const newEmployer = {
                name,
                ic,
                phone_number,
                email_address,
                physical_address
            }

            //insert new employer
            const result = await db.collection("employers").insertOne(newEmployer);

            //send back success employer creation
            res.status(201).json({
                message:    "employer data created successfully",
                result:     result.insertedId
            }) 
        } catch (error) {
            console.error('Error creating employer data:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    })

    app.put("/employers/:id", async function(req,res){
        try {
            let id = req.params.id;
            let {name, ic, phone_number, email_address, physical_address} = req.body;
            
            if(!name || !ic || !phone_number || !physical_address){
                res.status(400).json({
                    "error" : "missing fields required"
                })
            }

            let updatedEmployer = {
                name,
                ic,
                phone_number,
                email_address,
                physical_address
            }

            let result = db.collection("employers").updateOne({
                "_id": new ObjectId(id)
                },
            {
                "$set": updatedEmployer
            }
            )

            // if there is no matches, means no update took place
            if (result.matchedCount == 0) {
                return res.status(404).json({
                    "error": "Employer not found"
                })
            }

            res.status(200).json({
                "message": "Employer updated"
            })

            
        } catch (error) {
            console.error(e);
            res.status(500);
            
        }
    })

    app.delete("/employers/:id", async function(req,res){
        try {
            let id = req.params.id;

            let results = await db.collection('employers').deleteOne({
                "_id": new ObjectId(id)
            });

            if (results.deletedCount == 0) {
                return res.status(404).json({
                    "error": "Employer not found"
                });
            }

            res.json({
                "message": "Employer has been deleted successful"
            })
        } catch (error) {
            console.error(e);
            res.status(500);
        }
    })

    app.get("/helpers", async function (req, res) {
        try {

            // this is the same as let tags = req.query.tags etc. etc.
            // syntax: object destructuring

            // name: 1,
            // DOB: 1,
            // age: 1,
            // ethicGroup: 1,
            // Nationality: 1,
            // Skills:1
            let { name, DOB, age, ethicGroup, Nationality, Skills } = req.query;

            let criteria = {};

            if (name) {
                criteria["name"] = {
                    "$regex": name, "$options": "i"
                }
            }

            if (DOB) {
                criteria["DOB"] = {
                    "$regex": DOB, "$options": "i"
                }
            }
            if (age) {
                criteria["age"] = {
                    "$regex": age, "$options": "i"
                }
            }
            if (ethicGroup) {
                criteria["ethnicGroup"] = {
                    "$regex": ethicGroup, "$options": "i"
                }
            }
            if (Nationality) {
                criteria["Nationality"] = {
                    "$regex": Nationality, "$options": "i"
                }
            }

            if (Skills) {
                criteria["Skills"] = Skills;
            }
            

            // mongo shell: db.recipes.find({},{name:1, cuisine:1, tags:1, prepTime:1})
            let helpers = await db.collection("helpers").find(criteria)
                .project({
                    "name": 1,
                    "DOB": 1,
                    "age": 1,
                    "ethicGroup": 1,
                    "Nationality": 1,
                    "Skills" :1
                }).toArray();
            res.json({
                'helpers': helpers
            })
        } catch (error) {
            console.error("Error fetching helpers:", error);
            res.status(500);
        }
    })

    app.post("/helpers", async function(req,res){
        try {
            const{name, DOB, age, ethicGroup, Nationality, Skills} = req.body;

            if(!name || !DOB || !ethicGroup || !Nationality){
                return res.status(400).json({
                    error : "Missing required fields"
                })
            }

            const newHelper = {
                name,
                DOB,
                age,
                ethicGroup,
                Nationality,
                Skills
            };
            console.log(newHelper);

            //insert newHelper
            const result = await db.collection("helpers").insertOne(newHelper);

            //send back success creation notice of helper
            res.status(201).json({
                message: "helper data created successfully",
                result: result.insertedId
            })
            
        } catch (error) {
            console.error('Error creating helper data:', error);
            res.status(500).json({ error: 'Internal server error' });
            
        }
        

    })

    app.put("/helpers/:id", async function(req,res){
        try {
            let id = req.params.id;
            let {name, DOB, age, ethicGroup, Nationality, Skills} = req.body;
            
            if(!name || !DOB || !ethicGroup || !Nationality){
                res.status(400).json({
                    "error" : "missing fields required"
                })
            }

            let updatedHelper = {
                name,
                DOB,
                age,
                ethicGroup,
                Nationality,
                Skills
            }

            let result = await db.collection("helpers").updateOne({
                "_id": new ObjectId(id)
                },
            {
                "$set": updatedHelper
            }
            )

            // if there is no match, no update took place
            if (result.matchedCount == 0) {
                return res.status(404).json({
                    "error": "Helper not found"
                })
            }

            res.status(200).json({
                "message": "Helper updated successfully"
            })

        } catch (error) {
            console.error("Error updating helper:", error);
            res.status(500).json({ error: 'Internal server error' });
        }
    })

    app.delete("/helpers/:id", async function(req,res){
        try {
            let id = req.params.id;

            let results = await db.collection('helpers').deleteOne({
                "_id": new ObjectId(id)
            });

            if (results.deletedCount == 0) {
                return res.status(404).json({
                    "error": "Helper not found"
                });
            }

            res.json({
                "message": "Helper has been deleted successfully"
            })
        } catch (error) {
            console.error("Error deleting helper:", error);
            res.status(500).json({ error: 'Internal server error' });
        }
    })

    app.get("/contract", async function(req, res) {
        try {
            const contracts = await db.collection("contract").find({})
                .project({
                    employer: 1,
                    helper: 1,
                    startDate: 1,
                    loanFee: 1
                }).toArray();

            res.json({
                'contracts': contracts
            });
        } catch (error) {
            console.error("Error fetching contracts:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    app.get("/contract/:id", async function(req, res) {
        try {
            const id = req.params.id;

            const contract = await db.collection("contract").findOne(
                { _id: new ObjectId(id) },
                {
                    projection: {
                        employer: 1,
                        helper: 1,
                        startDate: 1,
                        loanFee: 1
                    }
                }
            );

            if (!contract) {
                return res.status(404).json({ error: "Contract not found" });
            }

            res.json(contract);
        } catch (error) {
            console.error("Error fetching contract:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    app.post("/contract", async function(req, res) {
        try {
            const { employerName, helperName } = req.body;
            const salary = 480;
            const months = 5;

            const formattedDate = generateTodayDate();
            const invoices = generateInvoices(formattedDate, months, salary);

            // Find employer by name (case insensitive)
            let employerData = await db.collection("employers").findOne({
                "name": { "$regex": employerName, "$options": "i" }  // Case-insensitive regex search
            }, {
                projection: {
                    "_id": 1,
                    "name": 1,
                    "ic": 1,
                    "physical_address": 1,
                    "contact_number": 1
                }
            });

            if (!employerData) {
                return res.status(404).json({
                    "error": "Employer not found"
                });
            }

            // Find helper by name (case insensitive)
            let helperData = await db.collection("helpers").findOne({
                "name": { "$regex": helperName, "$options": "i" }  // Case-insensitive regex search
            }, {
                projection: {
                    "_id": 1,
                    "name": 1
                }
            });

            if (!helperData) {
                return res.status(404).json({
                    "error": "Helper not found"
                });
            }

            // Combine employer and helper data
            let contractData = {
                employer: employerData,
                helper: helperData,
                startDate: formattedDate,
                loanFee: invoices
            };

            const result = await db.collection("contract").insertOne(contractData);

            // Send the contract data back as response
            res.status(200).json({
                "message": "Contract data setup successfully",
                "result": result.insertedId
            });

        } catch (error) {
            console.error("Error fetching contract data:", error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    //technically contract is created using employers and helpers data, so we should not use app.put in this case
    // app.put("/contract/:id", async function(req, res) {
    //     try {
    //         const id = req.params.id;
    //         const { employerName, helperName, startDate, loanFee } = req.body;

    //         if (!employerName || !helperName || !startDate || !loanFee) {
    //             return res.status(400).json({ error: "Missing required fields" });
    //         }

    //         const updatedContract = {
    //             employerName,
    //             helperName,
    //             startDate,
    //             loanFee
    //         };

    //         const result = await db.collection("contract").updateOne(
    //             { _id: new ObjectId(id) },
    //             { "$set": updatedContract }
    //         );

    //         if (result.matchedCount == 0) {
    //             return res.status(404).json({ error: "Contract not found" });
    //         }

    //         res.status(200).json({ message: "Contract updated successfully" });
    //     } catch (error) {
    //         console.error("Error updating contract:", error);
    //         res.status(500).json({ error: "Internal server error" });
    //     }
    // });

    app.delete("/contract/:id", async function(req, res) {
        try {
            const id = req.params.id;

            const result = await db.collection("contract").deleteOne({ _id: new ObjectId(id) });

            if (result.deletedCount == 0) {
                return res.status(404).json({ error: "Contract not found" });
            }

            res.json({ message: "Contract deleted successfully" });
        } catch (error) {
            console.error("Error deleting contract:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

// route for user to sign up
    // the user must provide an email and password
    app.post('/users', async function (req, res) {

        try {
            let { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({
                    "error": "Please provide user name and password"
                })
            }

            // if the request has both email and password
            let userDocument = {
                email,
                password: await bcrypt.hash(password, 12)
            };

            let result = await db.collection("users").insertOne(userDocument);

            res.json({
                "message":"New user account has been created",
                result
            })

        } catch (e) {
            console.error(e);
            res.status(500);
        }
    })

    // the client is supposed to provide the email and password in req.body
    app.post('/login', async function(req,res){
        try {
            let {email, password} = req.body;
            if (!email || !password) {
                return res.status(400).json({
                    'message':'Please provide email and password'
                })
            }

            // find the user by their email
            let user = await db.collection('users').findOne({
                "email": email
            });

            // if the user exists
            if (user) {
                // check the password (compare plaintext with the hashed one in the database)
                if (bcrypt.compareSync(password, user.password)) {
                    let accessToken = generateAccessToken(user._id, user.email);
                    res.json({
                        "accessToken": accessToken
                    })
                } else {
                    res.status(401);
                }
            } else {
                res.status(401);
            }

        } catch (e) {
            console.error(e);
            res.status(500);
        }
    })

    app.get('/profile', verifyToken, async function(req, res){

        // get the payload
        let user = req.user;

        res.json({
            user
        })

    })

}

main();

// START SERVER
app.listen(3000, () => {
  console.log("Server has started");
});