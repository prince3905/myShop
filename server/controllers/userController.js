const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const User = require("../models/userModel");

exports.createUser = (req, res) => {
  const newUser = new User(req.body);
  newUser
    .save()
    .then((savedUser) => {
      res.status(201).json(savedUser);
    })
    .catch((err) => {
      console.error("Error saving user:", err);
      res.status(500).json({ error: "Error saving user" });
    });
};

exports.userDetails = (req, res) => {
    const { id } = req.params;
  
    User.findById(id)
      .then(user => {
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }
  
        console.log("Found user:", user);
        res.status(200).json(user);
      })
      .catch(err => {
        console.error("Error finding user:", err);
        res.status(500).json({ error: "Error finding user" });
      });
  };
  

exports.allUser = async (req, res) => {
  try {
    const users = await User.find({});
    console.log(users);
    res.status(200).json(users);
  } catch (err) {
    console.error("Error retrieving users:", err);
    res.status(500).json({ error: "Error retrieving users" });
  }
};

exports.deleteUser = (req, res) => {
  const { id } = req.body;

  User.findByIdAndDelete(id)
    .then((deletedUser) => {
      if (!deletedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      console.log("Deleted user:", deletedUser);
      res.status(200).json({ message: "User deleted successfully" });
    })
    .catch((err) => {
      console.error("Error deleting user:", err);
      res.status(500).json({ error: "Error deleting user" });
    });
};

exports.updateUser = (req, res) => {
  const { id, email } = req.body;

  User.findByIdAndUpdate(id, { email }, { new: true })
    .then((updatedUser) => {
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      console.log("Updated user:", updatedUser);
      res
        .status(200)
        .json({ message: "User updated successfully", user: updatedUser });
    })
    .catch((err) => {
      console.error("Error updating user:", err);
      res.status(500).json({ error: "Error updating user" });
    });
};

// module.exports = { createUser, allUser, deleteUser };
