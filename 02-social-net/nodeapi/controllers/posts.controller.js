const postsCtrl = {};

const Post = require("../models/Post.js");

const formidable = require("formidable");

const fs = require("fs");

//const _ = require("underscore");
// use lodash
const _ = require("lodash");

postsCtrl.getPosts = async(req, res) => {
    try {
        // get current page from req.query or use default value of 1
        const currentPage = req.query.page || 1;
        // return 3 posts per page
        const perPage = 3;
        let totalItems;
        const posts = await Post.find()
            // countDocuments() gives you total count of posts
            .countDocuments()
            .then((count) => {
                totalItems = count;
                return Post.find()
                    .skip((currentPage - 1) * perPage)
                    .populate("comments", "text created")
                    .populate("comments.postedBy", "_id name")
                    .populate("postedBy", "_id name role")
                    .sort({ date: -1 })
                    .limit(perPage)
                    .select("_id title body likes");
            })
            .then((posts) => {
                res.json({
                    ok: true,
                    posts,
                });
            });
    } catch (err) {
        return res.status(500).json({
            ok: false,
            err,
        });
    }
};

postsCtrl.createPost = (req, res, next) => {
    // use formidable
    let form = new formidable.IncomingForm();
    console.log(req.body);
    form.keepExtensions = true;
    form.parse(req, (err, fields, files) => {
        if (err) {
            return res.status(400).json({
                err: "Image could not be uploaded",
            });
        }
        let post = new Post(fields);

        req.profile.hashed_password = undefined;
        req.profile.salt = undefined;
        post.postedBy = req.profile;

        if (files.photo) {
            post.photo.data = fs.readFileSync(files.photo.path);
            post.photo.contentType = files.photo.type;
        }
        post.save((err, result) => {
            if (err) {
                return res.status(400).json({
                    ok: false,
                    err,
                });
            }
            res.json({
                ok: true,
                post: result,
            });
        });
    });
    /*
                                                                                                                                                                    // arreglo de propiedades validas
                                                                                                                                                                    let body = _.pick(req.body, ["title", "body"]);
                                                                                                                                                                    const newPost = Post(body);
                                                                                                                                                                    try {
                                                                                                                                                                        let post = await newPost.save();
                                                                                                                                                                        res.json({
                                                                                                                                                                            ok: true,
                                                                                                                                                                            post,
                                                                                                                                                                            message: "Post save correctly",
                                                                                                                                                                        });
                                                                                                                                                                    } catch (err) {
                                                                                                                                                                        return res.status(400).json({
                                                                                                                                                                            ok: false,
                                                                                                                                                                            err,
                                                                                                                                                                        });
                                                                                                                                                                    }*/
};

postsCtrl.postsByUser = (req, res) => {
    Post.find({ postedBy: req.profile._id })
        .populate("postedBy", "_id name")
        .populate("comments", "text created")
        .populate("comments.postedBy", "_id name role")
        .select("_id title body created likes comments") // {},{}
        .sort("_created")
        .exec((err, posts) => {
            if (err) {
                return res.status(400).json({
                    ok: false,
                    err,
                });
            }
            res.json({
                ok: true,
                posts,
            });
        });
};

postsCtrl.postById = (req, res, next, id) => {
    Post.findById(id)
        .populate("postedBy", "_id name")
        .populate("comments", "text created")
        .populate("comments.postedBy", "_id name role")
        .select("_id title body created photo likes comments")
        .exec((err, post) => {
            if (err || !post) {
                return res.status(400).json({
                    ok: false,
                    err,
                });
            }
            req.post = post;
            next();
        });
};
postsCtrl.isPoster = (req, res, next) => {
    let sameUser = req.post && req.auth && req.post.postedBy._id == req.auth._id;
    let adminUser = req.post && req.auth && req.auth.role === "admin";

    //console.log("req.post ", req.post, " req.auth ", req.auth);
    // console.log("SAMEUSER: ", sameUser, " ADMINUSER: ", adminUser);

    let isPoster = sameUser || adminUser;

    //let isPoster = req.post && req.auth && req.post.postedBy._id == req.auth._id;
    //console.log(isPoster);
    if (!isPoster) {
        return res.status(403).json({
            ok: false,
            err: "User is not authorized",
        });
    }
    next();
};

postsCtrl.deletePost = (req, res) => {
    let post = req.post;
    post.remove((err, post) => {
        if (err) {
            return res.status(400).json({
                ok: false,
                err,
            });
        }
        res.json({
            ok: true,
            message: "Post deleted successfully",
        });
    });
};
postsCtrl.updatePost = (req, res, next) => {
    let form = new formidable.IncomingForm();
    form.keepExtensions = true;
    form.parse(req, (err, fields, files) => {
        if (err) {
            return res.status(400).json({
                err: "Photo could not be uploaded",
            });
        }
        // save post
        let post = req.post;
        post = _.extend(post, fields);
        post.updated = Date.now();

        if (files.photo) {
            post.photo.data = fs.readFileSync(files.photo.path);
            post.photo.contentType = files.photo.type;
        }

        post.save((err) => {
            if (err) {
                return res.status(400).json({
                    err,
                });
            }
            res.json(post);
        });
    });
};

postsCtrl.postPhoto = (req, res, next) => {
    if (req.post.photo.data) {
        res.set("Content-Type", req.post.photo.contentType);
        return res.send(req.post.photo.data);
    }
    next();
};

postsCtrl.singlePost = (req, res) => {
    return res.json(req.post);
};

postsCtrl.like = (req, res) => {
    Post.findByIdAndUpdate(
        req.body.postId, { $push: { likes: req.body.userId } }, { new: true }
    ).exec((err, result) => {
        if (err) {
            return res.status(400).json({
                err,
            });
        } else {
            res.json(result);
        }
    });
};

postsCtrl.unlike = (req, res) => {
    Post.findByIdAndUpdate(
        req.body.postId, { $pull: { likes: req.body.userId } }, { new: true }
    ).exec((err, result) => {
        if (err) {
            return res.status(400).json({
                err,
            });
        } else {
            res.json(result);
        }
    });
};

postsCtrl.comment = (req, res) => {
    let comment = req.body.comment;
    comment.postedBy = req.body.userId;

    Post.findByIdAndUpdate(
            req.body.postId, { $push: { comments: comment } }, { new: true }
        )
        .populate("comments.postedBy", "_id name")
        .populate("postedBy", "_id name")
        .exec((err, result) => {
            if (err) {
                return res.status(400).json({
                    err,
                });
            } else {
                res.json(result);
            }
        });
};

postsCtrl.uncomment = (req, res) => {
    let comment = req.body.comment;

    Post.findByIdAndUpdate(
            req.body.postId, { $pull: { comments: { _id: comment._id } } }, { new: true }
        )
        .populate("comments.postedBy", "_id name")
        .populate("postedBy", "_id name")
        .exec((err, result) => {
            if (err) {
                return res.status(400).json({
                    err,
                });
            } else {
                res.json(result);
            }
        });
};

module.exports = postsCtrl;