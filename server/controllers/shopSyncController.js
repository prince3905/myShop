const logger = require("../utils/logger");
const Shop = require("../models/Shop");
const Category = require("../models/Category");
const Brand = require("../models/Brand");
const Product = require("../models/Product");
const ProductModel = require("../models/ProductModel");
const ProductVariation = require("../models/ProductVariation");
const Stock = require("../models/Stock");
const Distributor = require("../models/Distributor");
const slugify = require("slugify");

/**
 * Helper to escape regex special characters
 */
const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Bulk Clone / Sync Shop Data from Source Shop to Target Shop
 */
exports.cloneShopData = async (req, res) => {
  try {
    const {
      sourceShopId,
      targetShopId,
      includeCategories = true,
      includeBrands = true,
      includeProducts = true,
      includeDistributors = true,
    } = req.body;

    if (!sourceShopId || !targetShopId) {
      return res.status(400).json({
        success: false,
        message: "Source Shop and Target Shop are required",
      });
    }

    if (`${sourceShopId}` === `${targetShopId}`) {
      return res.status(400).json({
        success: false,
        message: "Source Shop and Target Shop cannot be the same",
      });
    }

    const [sourceShop, targetShop] = await Promise.all([
      Shop.findById(sourceShopId),
      Shop.findById(targetShopId),
    ]);

    if (!sourceShop || !targetShop) {
      return res.status(404).json({
        success: false,
        message: "Source or Target Shop not found",
      });
    }

    const stats = {
      categoriesCopied: 0,
      brandsCopied: 0,
      productsCopied: 0,
      variationsCopied: 0,
      distributorsCopied: 0,
      skippedItems: 0,
    };

    // Maps to track old ID -> new ID mapping for target shop
    const categoryMap = new Map(); // sourceCatId -> targetCatId
    const brandMap = new Map();    // sourceBrandId -> targetBrandId

    // 1. CLONE BRANDS
    if (includeBrands) {
      const sourceBrands = await Brand.find({
        $or: [{ shop: sourceShopId }, { shop: null }],
        isDeleted: { $ne: true },
      });

      for (const b of sourceBrands) {
        try {
          let existingBrand = await Brand.findOne({
            $or: [{ shop: targetShopId }, { shop: null }],
            name: new RegExp(`^${escapeRegex(b.name)}$`, "i"),
            isDeleted: { $ne: true },
          });

          if (!existingBrand) {
            existingBrand = await Brand.create({
              name: b.name,
              shop: targetShopId,
              description: b.description,
              logo: b.logo,
              isActive: true,
            });
            stats.brandsCopied++;
          }
          brandMap.set(b._id.toString(), existingBrand._id.toString());
        } catch (err) {
          if (err.code === 11000) stats.skippedItems++;
          else throw err;
        }
      }
    }

    // 2. CLONE CATEGORIES
    if (includeCategories) {
      const sourceCategories = await Category.find({
        $or: [{ shop: sourceShopId }, { shop: null }],
        isDeleted: { $ne: true },
      });

      for (const c of sourceCategories) {
        try {
          let existingCat = await Category.findOne({
            $or: [{ shop: targetShopId }, { shop: null }],
            name: new RegExp(`^${escapeRegex(c.name)}$`, "i"),
            isDeleted: { $ne: true },
          });

          const mappedBrandIds = (c.brands || [])
            .map((bId) => brandMap.get(bId.toString()))
            .filter(Boolean);

          if (!existingCat) {
            existingCat = await Category.create({
              name: c.name,
              icon: c.icon || "folder",
              description: c.description,
              brands: mappedBrandIds,
              shop: targetShopId,
              isActive: true,
            });
            stats.categoriesCopied++;
          } else {
            const currentBrandIds = (existingCat.brands || []).map((b) => b.toString());
            const mergedBrands = Array.from(new Set([...currentBrandIds, ...mappedBrandIds]));
            existingCat.brands = mergedBrands;
            await existingCat.save();
          }
          categoryMap.set(c._id.toString(), existingCat._id.toString());
        } catch (err) {
          if (err.code === 11000) stats.skippedItems++;
          else throw err;
        }
      }
    }

    // 3. CLONE PRODUCTS, MODELS & VARIATIONS
    if (includeProducts) {
      const sourceProducts = await Product.find({
        shop: sourceShopId,
        isDeleted: { $ne: true },
      }).populate({
        path: "variations",
        populate: { path: "model" },
      });

      for (const p of sourceProducts) {
        try {
          let targetProduct = await Product.findOne({
            shop: targetShopId,
            name: new RegExp(`^${escapeRegex(p.name)}$`, "i"),
            isDeleted: { $ne: true },
          });

          const targetCatId = categoryMap.get(p.category?.toString()) || p.category;
          const targetBrandId = brandMap.get(p.brand?.toString()) || p.brand;

          if (!targetProduct) {
            targetProduct = await Product.create({
              name: p.name,
              slug: slugify(p.name, { lower: true, strict: true }) + "-" + Date.now().toString(36),
              category: targetCatId,
              brand: targetBrandId,
              description: p.description,
              icon: p.icon,
              images: p.images || [],
              shop: targetShopId,
              isActive: true,
            });
            stats.productsCopied++;
          }

          const sourceVariations = p.variations || [];
          for (const v of sourceVariations) {
            let targetModelId = null;
            if (v.model) {
              const modelName = v.model.name || "Default Model";
              let targetModel = await ProductModel.findOne({
                shop: targetShopId,
                product: targetProduct._id,
                name: new RegExp(`^${escapeRegex(modelName)}$`, "i"),
              });

              if (!targetModel) {
                targetModel = await ProductModel.create({
                  name: modelName,
                  product: targetProduct._id,
                  shop: targetShopId,
                  isActive: true,
                });
              }
              targetModelId = targetModel._id;
            }

            const targetSku = `${v.sku || "SKU"}-${targetShop.shopCode || "SHOP"}`;
            const targetBarcode = v.barcode ? `${v.barcode}-${targetShop.shopCode}` : undefined;

            let existingVariation = await ProductVariation.findOne({
              shop: targetShopId,
              $or: [
                { sku: targetSku },
                { sku: v.sku },
                ...(targetBarcode ? [{ barcode: targetBarcode }] : []),
                {
                  product: targetProduct._id,
                  model: targetModelId,
                  "attributes.color": v.attributes?.color,
                  "attributes.size": v.attributes?.size,
                },
              ],
            });

            if (!existingVariation) {
              existingVariation = await ProductVariation.create({
                product: targetProduct._id,
                model: targetModelId,
                shop: targetShopId,
                sku: targetSku,
                barcode: targetBarcode,
                attributes: v.attributes || {},
                sellingPrice: v.sellingPrice || 0,
                costPrice: v.costPrice || 0,
                quantity: 0,
                isActive: true,
              });

              await Product.findByIdAndUpdate(targetProduct._id, {
                $addToSet: { variations: existingVariation._id },
              });

              await Stock.create({
                shop: targetShopId,
                product: targetProduct._id,
                variation: existingVariation._id,
                model: targetModelId,
                sku: existingVariation.sku,
                barcode: existingVariation.barcode,
                quantity: 0,
                reorderLevel: 5,
              });

              stats.variationsCopied++;
            } else {
              stats.skippedItems++;
            }
          }
        } catch (err) {
          if (err.code === 11000) stats.skippedItems++;
          else throw err;
        }
      }
    }

    // 4. CLONE DISTRIBUTORS
    if (includeDistributors) {
      const sourceDistributors = await Distributor.find({
        shop: sourceShopId,
        isDeleted: { $ne: true },
      });

      for (const d of sourceDistributors) {
        let existingDist = await Distributor.findOne({
          shop: targetShopId,
          isDeleted: { $ne: true },
          $or: [
            { phone: d.phone },
            { name: new RegExp(`^${escapeRegex(d.name)}$`, "i") },
            ...(d.email ? [{ email: d.email }] : []),
          ],
        });

        if (!existingDist) {
          let targetEmail = d.email;
          try {
            await Distributor.create({
              shop: targetShopId,
              name: d.name,
              shopName: d.shopName,
              email: targetEmail,
              phone: d.phone,
              telephone: d.telephone,
              gstNumber: d.gstNumber,
              address: d.address || {},
              openingBalance: 0,
              currentBalance: 0,
              creditLimit: d.creditLimit || 0,
              paymentTerms: d.paymentTerms || 0,
              status: "active",
              createdBy: req.user?._id,
            });
            stats.distributorsCopied++;
          } catch (err) {
            if (err.code === 11000 && targetEmail && targetEmail.includes("@")) {
              const parts = targetEmail.split("@");
              targetEmail = `${parts[0]}+${targetShop.shopCode.toLowerCase()}@${parts[1]}`;
              try {
                await Distributor.create({
                  shop: targetShopId,
                  name: d.name,
                  shopName: d.shopName,
                  email: targetEmail,
                  phone: d.phone,
                  telephone: d.telephone,
                  gstNumber: d.gstNumber,
                  address: d.address || {},
                  openingBalance: 0,
                  currentBalance: 0,
                  creditLimit: d.creditLimit || 0,
                  paymentTerms: d.paymentTerms || 0,
                  status: "active",
                  createdBy: req.user?._id,
                });
                stats.distributorsCopied++;
              } catch (retryErr) {
                stats.skippedItems++;
              }
            } else if (err.code === 11000) {
              stats.skippedItems++;
            } else {
              throw err;
            }
          }
        } else {
          stats.skippedItems++;
        }
      }
    }

    logger.info(
      `Shop Sync Complete: ${sourceShop.name} -> ${targetShop.name}`,
      stats
    );

    return res.status(200).json({
      success: true,
      message: `Successfully cloned data from ${sourceShop.name} to ${targetShop.name}`,
      stats,
    });
  } catch (error) {
    logger.error("Error in cloneShopData:", error);
    return res.status(500).json({
      success: false,
      message: "Error cloning shop data",
      error: error.message,
    });
  }
};

/**
 * Copy single Distributor to Target Shop
 */
exports.copySingleDistributor = async (req, res) => {
  try {
    const { distributorId, targetShopId } = req.body;

    if (!distributorId || !targetShopId) {
      return res.status(400).json({
        success: false,
        message: "Distributor ID and Target Shop ID are required",
      });
    }

    const [distributor, targetShop] = await Promise.all([
      Distributor.findById(distributorId),
      Shop.findById(targetShopId),
    ]);

    if (!distributor) {
      return res.status(404).json({ success: false, message: "Distributor not found" });
    }

    if (!targetShop) {
      return res.status(404).json({ success: false, message: "Target Shop not found" });
    }

    const existing = await Distributor.findOne({
      shop: targetShopId,
      isDeleted: { $ne: true },
      $or: [
        { phone: distributor.phone },
        { name: new RegExp(`^${escapeRegex(distributor.name)}$`, "i") },
        ...(distributor.email ? [{ email: distributor.email }] : []),
      ],
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Distributor "${distributor.name}" already exists in ${targetShop.name}`,
      });
    }

    let targetEmail = distributor.email;
    let copied;
    try {
      copied = await Distributor.create({
        shop: targetShopId,
        name: distributor.name,
        shopName: distributor.shopName,
        email: targetEmail,
        phone: distributor.phone,
        telephone: distributor.telephone,
        gstNumber: distributor.gstNumber,
        address: distributor.address || {},
        openingBalance: 0,
        currentBalance: 0,
        creditLimit: distributor.creditLimit || 0,
        paymentTerms: distributor.paymentTerms || 0,
        status: "active",
        createdBy: req.user?._id,
      });
    } catch (err) {
      if (err.code === 11000 && targetEmail && targetEmail.includes("@")) {
        const parts = targetEmail.split("@");
        targetEmail = `${parts[0]}+${targetShop.shopCode.toLowerCase()}@${parts[1]}`;
        copied = await Distributor.create({
          shop: targetShopId,
          name: distributor.name,
          shopName: distributor.shopName,
          email: targetEmail,
          phone: distributor.phone,
          telephone: distributor.telephone,
          gstNumber: distributor.gstNumber,
          address: distributor.address || {},
          openingBalance: 0,
          currentBalance: 0,
          creditLimit: distributor.creditLimit || 0,
          paymentTerms: distributor.paymentTerms || 0,
          status: "active",
          createdBy: req.user?._id,
        });
      } else {
        throw err;
      }
    }

    return res.status(201).json({
      success: true,
      message: `Distributor copied successfully to ${targetShop.name}`,
      data: copied,
    });
  } catch (error) {
    logger.error("Error copying single distributor:", error);
    return res.status(500).json({
      success: false,
      message: "Error copying distributor",
      error: error.message,
    });
  }
};

/**
 * Copy single Product & Variations to Target Shop
 */
exports.copySingleProduct = async (req, res) => {
  try {
    const { productId, targetShopId } = req.body;

    if (!productId || !targetShopId) {
      return res.status(400).json({
        success: false,
        message: "Product ID and Target Shop ID are required",
      });
    }

    const [product, targetShop] = await Promise.all([
      Product.findById(productId).populate({
        path: "variations",
        populate: { path: "model" },
      }),
      Shop.findById(targetShopId),
    ]);

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    if (!targetShop) {
      return res.status(404).json({ success: false, message: "Target Shop not found" });
    }

    let targetProduct = await Product.findOne({
      shop: targetShopId,
      name: new RegExp(`^${escapeRegex(product.name)}$`, "i"),
      isDeleted: { $ne: true },
    });

    if (!targetProduct) {
      targetProduct = await Product.create({
        name: product.name,
        slug: slugify(product.name, { lower: true, strict: true }) + "-" + Date.now().toString(36),
        category: product.category,
        brand: product.brand,
        description: product.description,
        icon: product.icon,
        images: product.images || [],
        shop: targetShopId,
        isActive: true,
      });
    }

    let copiedVariationsCount = 0;
    const sourceVariations = product.variations || [];

    for (const v of sourceVariations) {
      let targetModelId = null;
      if (v.model) {
        const modelName = v.model.name || "Default Model";
        let targetModel = await ProductModel.findOne({
          shop: targetShopId,
          product: targetProduct._id,
          name: new RegExp(`^${escapeRegex(modelName)}$`, "i"),
        });

        if (!targetModel) {
          targetModel = await ProductModel.create({
            name: modelName,
            product: targetProduct._id,
            shop: targetShopId,
            isActive: true,
          });
        }
        targetModelId = targetModel._id;
      }

      const targetSku = `${v.sku || "SKU"}-${targetShop.shopCode || "SHOP"}`;
      const targetBarcode = v.barcode ? `${v.barcode}-${targetShop.shopCode}` : undefined;

      let existingVar = await ProductVariation.findOne({
        shop: targetShopId,
        $or: [
          { sku: targetSku },
          { sku: v.sku },
          ...(targetBarcode ? [{ barcode: targetBarcode }] : []),
        ],
      });

      if (!existingVar) {
        existingVar = await ProductVariation.create({
          product: targetProduct._id,
          model: targetModelId,
          shop: targetShopId,
          sku: targetSku,
          barcode: targetBarcode,
          attributes: v.attributes || {},
          sellingPrice: v.sellingPrice || 0,
          costPrice: v.costPrice || 0,
          quantity: 0,
          isActive: true,
        });

        await Product.findByIdAndUpdate(targetProduct._id, {
          $addToSet: { variations: existingVar._id },
        });

        await Stock.create({
          shop: targetShopId,
          product: targetProduct._id,
          variation: existingVar._id,
          model: targetModelId,
          sku: existingVar.sku,
          barcode: existingVar.barcode,
          quantity: 0,
          reorderLevel: 5,
        });

        copiedVariationsCount++;
      }
    }

    return res.status(200).json({
      success: true,
      message: `Product "${product.name}" copied to ${targetShop.name}`,
      product: targetProduct,
      variationsCopied: copiedVariationsCount,
    });
  } catch (error) {
    logger.error("Error copying single product:", error);
    return res.status(500).json({
      success: false,
      message: "Error copying product",
      error: error.message,
    });
  }
};
