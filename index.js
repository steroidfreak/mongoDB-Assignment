// SETUP BEGINS
const express = require("express");
const cors = require("cors");
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

// SETUP END
async function main() {
    const db = await connect(mongoUri, dbname);

  // Routes

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
        console.log(id)
        
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


// app.get("/recipes/:id", async (req, res) => {
//     try {
//         const id = req.params.id;
        
//         // First, fetch the recipe
//         const recipe = await db.collection("recipes").findOne(
//             { _id: new ObjectId(id) },
//             { projection: { _id: 0 } }
//         );
        
//         if (!recipe) {
//             return res.status(404).json({ error: "Recipe not found" });
//         }
        
       

        
//         res.json(recipe);
//     } catch (error) {
//         console.error("Error fetching recipe:", error);
//         res.status(500).json({ error: "Internal server error" });
//     }
// });

// app.post('/recipes', async (req, res) => {
//     try {
//         const { name, cuisine, prepTime, cookTime, servings, ingredients, instructions, tags } = req.body;

//         // Basic validation
//         if (!name || !cuisine || !ingredients || !instructions || !tags) {
//             return res.status(400).json({ error: 'Missing required fields' });
//         }

//         // Fetch the cuisine document
//         const cuisineDoc = await db.collection('cuisines').findOne({ name: cuisine });
//         if (!cuisineDoc) {
//             return res.status(400).json({ error: 'Invalid cuisine' });
//         }

//         // Fetch the tag documents
//         const tagDocs = await db.collection('tags').find({ name: { $in: tags } }).toArray();
//         if (tagDocs.length !== tags.length) {
//             return res.status(400).json({ error: 'One or more invalid tags' });
//         }

//         // Create the new recipe object
//         const newRecipe = {
//             name,
//             cuisine: {
//                 _id: cuisineDoc._id,
//                 name: cuisineDoc.name
//             },
//             prepTime,
//             cookTime,
//             servings,
//             ingredients,
//             instructions,
//             tags: tagDocs.map(tag => ({
//                 _id: tag._id,
//                 name: tag.name
//             }))
//         };

//         // Insert the new recipe into the database
//         const result = await db.collection('recipes').insertOne(newRecipe);

//         // Send back the created recipe
//         res.status(201).json({
//             message: 'Recipe created successfully',
//             recipeId: result.insertedId
//         });
//     } catch (error) {
//         console.error('Error creating recipe:', error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// });



 

main();

// START SERVER
app.listen(3000, () => {
  console.log("Server has started");
});