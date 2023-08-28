const Order = require('../models/order');
const Customer = require('../models/customerModel');
const Item = require('../models/itemModel');

exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('customer')
      .populate('items.product');
    res.status(200).json(orders);
  } catch (err) {
    console.error('Error retrieving orders:', err);
    res.status(500).json({ error: 'Error retrieving orders' });
  }
};

exports.createOrder = async (req, res) => {
  const { customerId, items } = req.body;
  
  try {
    // Fetch the customer
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Validate and fetch items from the database
    const validatedItems = [];
    for (const item of items) {
      const product = await Item.findById(item.product);
      if (!product) {
        return res.status(404).json({ error: `Product with ID ${item.product} not found` });
      }
      validatedItems.push({ product: item.product, quantity: item.quantity });
    }

    // Calculate total amount
    const totalAmount = validatedItems.reduce((total, item) => {
      const product = items.find(i => i.product === item.product);
      return total + product.quantity * product.product.s_price;
    }, 0);

    const newOrder = new Order({
      customer: customerId,
      items: validatedItems,
      totalAmount,
    });

    const savedOrder = await newOrder.save();
    res.status(201).json({
      message: 'Order created successfully.',
      order: savedOrder,
    });
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).json({ error: 'Error creating order' });
  }
};

// Implement update and delete methods similarly
// Remember to validate and handle errors appropriately
