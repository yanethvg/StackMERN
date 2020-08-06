const usersCtrl = {};
// use lodash
const _ = require("lodash");

const User = require("../models/User.js");

// you need because have the information at user that login user
usersCtrl.userById = (req, res, next, id) => {
    User.findById(id)
        // populate followers and following users array
        //.populate("following", "_id name")
        //.populate("followers", "_id name")
        .exec((err, user) => {
            if (err || !user) {
                return res.status(400).json({
                    err: "User not found",
                });
            }
            req.profile = user; // adds profile object in req with user info
            //console.log(user);
            next();
        });
};

usersCtrl.hasAuthorization = (req, res, next) => {
    //let sameUser = req.profile && req.auth && req.profile._id == req.auth._id;
    //let adminUser = req.profile && req.auth && req.auth.role === 'admin';

    // const authorized = sameUser || adminUser;
    const authorized = req.profile && req.auth && req.profile._id == req.auth._id;

    // console.log("req.profile ", req.profile, " req.auth ", req.auth);
    // console.log("SAMEUSER", sameUser, "ADMINUSER", adminUser);

    if (!authorized) {
        return res.status(403).json({
            error: "User is not authorized to perform this action",
        });
    }
    next();
};

usersCtrl.getUsers = (req, res) => {
    //console.log(req.profile);
    User.find((err, users) => {
        if (err) {
            return res.status(400).json({
                error: err,
            });
        }
        res.json({
            ok: true,
            users,
        });
    }).select("name email updated created");
};

usersCtrl.getUser = (req, res) => {
    req.profile.hashed_password = undefined;
    req.profile.salt = undefined;
    return res.json(req.profile);
};

usersCtrl.updateUser = (req, res, next) => {
    // save user
    let user = req.profile;
    user = _.extend(user, req.body); // extend -- mutate the source object

    user.updated = Date.now();

    user.save((err) => {
        if (err) {
            return res.status(400).json({
                err: "You are not authorized to perform this action",
            });
        }
        user.hashed_password = undefined;
        user.salt = undefined;

        res.json({
            ok: true,
            user,
        });
    });
};

usersCtrl.deleteUser = (req, res, next) => {
    let user = req.profile;
    user.remove((err, user) => {
        if (err) {
            return res.status(400).json({
                error: err,
            });
        }
        res.json({ ok:true,message: "User deleted successfully" });
    });
};

module.exports = usersCtrl;