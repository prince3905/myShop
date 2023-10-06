const Order = require('../models/order');
const Customer = require('../models/customerModel');
const Item = require('../models/itemModel');

exports.getAllOrders = async (req, res) => {
  const { name, page = 1, perPage = 10 } = req.query;
  const query = name ? { name: { $regex: name, $options: 'i' } } : {};

  try {
    const totalItems = await Order.countDocuments(query);
    const skipItems = (page - 1) * perPage;
    const orders = await Order.find(query)
      .skip(skipItems)
      .limit(perPage)
      .populate('customer')
      .populate('items.product');

    res.status(200).json({ orders, totalItems });
  } catch (err) {
    console.error('Error retrieving orders:', err);
    res.status(500).json({ error: 'Error retrieving orders' });
  }
};

exports.createOrder = async (req, res) => {
  const { customerId, items } = req.body;

  try {
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    let totalAmount = 0;
    let totalQuantity = 0;

    const validatedItems = await Promise.all(
      items.map(async (item) => {
        const product = await Item.findById(item.product)
        .populate('brand')
        .populate('category');

        if (!product) {
          return res.status(404).json({ error: `Product with ID ${item.product} not found` });
        }
        totalAmount += item.quantity * product.s_price;
        totalQuantity += item.quantity;
        return { product: item.product, quantity: item.quantity, productDetails: product.toObject() };
      })
    );

    const savedOrder = await Order.create({
      customer: customerId,
      items: validatedItems,
      totalAmount,
      totalQuantity,
    });

    res.status(201).json({
      message: 'Order created successfully.',
      order: savedOrder.toObject(),
    });
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).json({ error: 'Error creating order' });
  }
};


