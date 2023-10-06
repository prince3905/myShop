const Distributor = require('../models/distributorModel');
const Item = require('../models/itemModel');

exports.allDistributors = async (req, res) => {
  try {
    const distributors = await Distributor.find().populate('items');
    res.status(200).json(distributors);
  } catch (err) {
    console.error('Error retrieving distributors:', err);
    res.status(500).json({ error: 'Error retrieving distributors' });
  }
};

exports.addDistributor = async (req, res) => {
  try {
    console.log(req.body)
    const newDistributorData = {
      name: req.body.name,
      shopName: req.body.shopName,
      email: req.body.email,
      phone: req.body.phone,
      telephone: req.body.telephone,
      address: req.body.address,
      items: req.body.items || [],
      createdAt: new Date(),
    };

    const newDistributor = new Distributor(newDistributorData);
    const savedDistributor = await newDistributor.save();
    
    res.status(201).json({
      message: 'Distributor added successfully.',
      distributor: savedDistributor,
    });
  } catch (err) {
    console.error('Error saving distributor:', err);
    res.status(500).json({ error: 'Error saving distributor' });
  }
};


exports.getDistributorDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const distributor = await Distributor.findById(id).populate('products');
    if (!distributor) {
      return res.status(404).json({ error: 'Distributor not found' });
    }
    res.status(200).json(distributor);
  } catch (err) {
    console.error('Error retrieving distributor details:', err);
    res.status(500).json({ error: 'Error retrieving distributor details' });
  }
};

exports.updateDistributor = async (req, res) => {
  const { id } = req.params;
  const updatedDistributorData = req.body;
  try {
    const updatedDistributor = await Distributor.findByIdAndUpdate(
      id,
      updatedDistributorData,
      { new: true }
    );
    if (!updatedDistributor) {
      return res.status(404).json({ error: 'Distributor not found' });
    }
    res
      .status(200)
      .json({
        message: 'Distributor updated successfully',
        distributor: updatedDistributor,
      });
  } catch (err) {
    console.error('Error updating distributor:', err);
    res.status(500).json({ error: 'Error updating distributor' });
  }
};

exports.deleteDistributor = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedDistributor = await Distributor.findByIdAndDelete(id);
    if (!deletedDistributor) {
      return res.status(404).json({ error: 'Distributor not found' });
    }
    res.status(200).json({ message: 'Distributor deleted successfully' });
  } catch (err) {
    console.error('Error deleting distributor:', err);
    res.status(500).json({ error: 'Error deleting distributor' });
  }
};
