import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { databases, storage } from "../appwrite/client"; // import storage
import { PackagePlus, Tag, CircleDollarSign, Warehouse, FileText, ImageUp, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';


const APPWRITE_BUCKET_ID = import.meta.env.VITE_APPWRITE_BUCKET_ID;
const APPWRITE_DB_ID = import.meta.env.VITE_APPWRITE_DB_ID;
const APPWRITE_COLLECTION_ID = import.meta.env.VITE_APPWRITE_COLLECTION_ID;
const APPWRITE_PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID;
const APPWRITE_ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT;

const AddProduct = ({ user, setProducts, onBack }) => {
    const navigate = useNavigate();
    const [product, setProduct] = useState({
        name: "",
        category: "",
        price: "",
        stock: "",
        description: "",
        image: null,
    });
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [addedProduct, setAddedProduct] = useState(null);

    const handleChange = (e) => {
        const { name, value, files } = e.target;
        if (name === "image") {
            setProduct((prev) => ({ ...prev, image: files[0] }));
        } else {
            setProduct((prev) => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        setAddedProduct(null);
        setIsSubmitting(true);

        if (!user || !user.uid) {
            setError("User not authenticated. Please login again.");
            setIsSubmitting(false);
            return;
        }

        if (!product.name || !product.category || !product.price || !product.stock) {
            setError("Please fill all required fields.");
            setIsSubmitting(false);
            return;
        }

        try {
            let imageUrl = "";
            // 1. Upload image if present
            if (product.image) {
                const file = product.image;
                const uploadResponse = await storage.createFile(
                    APPWRITE_BUCKET_ID, // from env
                    "unique()",
                    file,
                    ['read("any")'] // CORRECT public read permission
                );
                // 2. Manually construct the public URL
                imageUrl = `${APPWRITE_ENDPOINT}/storage/buckets/${APPWRITE_BUCKET_ID}/files/${uploadResponse.$id}/view?project=${APPWRITE_PROJECT_ID}`;
            }

            // 3. Save product with image URL (empty string if no image)
            const response = await databases.createDocument(
                APPWRITE_DB_ID, // from env
                APPWRITE_COLLECTION_ID, // from env
                'unique()',
                {
                    name: product.name,
                    category: product.category,
                    price: Number(product.price),
                    stock: Number(product.stock),
                    description: product.description,
                    user_id: user.uid,
                    image_url: imageUrl // will be "" if no image
                }
            );
            setSuccess("Product added successfully!");
            setAddedProduct(response);
            setProduct({
                name: "",
                category: "",
                price: "",
                stock: "",
                description: "",
                image: null,
            });
            // Also clear the file input visually
            e.target.reset();
        } catch (err) {
            setError("Error adding product. Please try again.");
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 flex items-center justify-center">
            <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-2xl relative">
                 <button 
                    onClick={onBack} 
                    className="absolute top-4 left-4 p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 transition"
                    title="Go Back to Dashboard"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <form
                    onSubmit={handleSubmit}
                    encType="multipart/form-data"
                >
                    <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center flex items-center justify-center gap-3">
                        <PackagePlus className="w-8 h-8 text-indigo-600" />
                        Add New Product
                    </h2>

                    {error && (
                        <div className="my-4 flex items-center gap-3 text-center p-3 bg-red-100 text-red-700 rounded-lg">
                            <AlertCircle className="w-5 h-5" />
                            <span>{error}</span>
                        </div>
                    )}
                    {success && (
                        <div className="my-4 flex items-center justify-between p-3 bg-green-100 text-green-700 rounded-lg">
                             <div className="flex items-center gap-3">
                                <CheckCircle className="w-5 h-5" />
                               <span>{success}</span>
                            </div>
                            {addedProduct && (
                                <button
                                    onClick={() => navigate('/products')}
                                    className="font-semibold text-green-800 hover:text-green-900 hover:underline"
                                >
                                    View Products
                                </button>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className="block mb-2 font-medium text-gray-700 flex items-center gap-2"><PackagePlus className="w-5 h-5" /> Product Name *</label>
                            <input
                                type="text" name="name" value={product.name} onChange={handleChange} required
                                className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                                placeholder="e.g., Silk Saree"
                            />
                        </div>
                        <div>
                            <label className="block mb-2 font-medium text-gray-700 flex items-center gap-2"><Tag className="w-5 h-5" /> Category *</label>
                            <input
                                type="text" name="category" value={product.category} onChange={handleChange} required
                                className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                                placeholder="e.g., Apparel"
                            />
                        </div>
                        <div>
                            <label className="block mb-2 font-medium text-gray-700 flex items-center gap-2"><CircleDollarSign className="w-5 h-5" /> Price (₹) *</label>
                            <input
                                type="number" name="price" value={product.price} onChange={handleChange} required
                                className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                                placeholder="e.g., 2999"
                            />
                        </div>
                        <div>
                            <label className="block mb-2 font-medium text-gray-700 flex items-center gap-2"><Warehouse className="w-5 h-5" /> Stock Quantity *</label>
                            <input
                                type="number" name="stock" value={product.stock} onChange={handleChange} required
                                className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                                placeholder="e.g., 50"
                            />
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block mb-2 font-medium text-gray-700 flex items-center gap-2"><FileText className="w-5 h-5" /> Description</label>
                        <textarea
                            name="description" value={product.description} onChange={handleChange}
                            className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                            rows={4}
                            placeholder="Add key features, materials, and other details..."
                        />
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                            <ImageUp className="w-5 h-5" /> Product Image
                        </label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg">
                            <div className="space-y-1 text-center">
                                <ImageUp className="mx-auto h-12 w-12 text-gray-400" />
                                <div className="flex text-sm text-gray-600">
                                    <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                                        <span>Upload a file</span>
                                        <input id="file-upload" name="image" type="file" className="sr-only" onChange={handleChange} />
                                    </label>
                                    <p className="pl-1">or drag and drop</p>
                                </div>
                                {product.image ? (
                                    <p className="text-sm text-green-600 pt-2">{product.image.name}</p>
                                ) : (
                                    <p className="text-xs text-gray-500">PNG, JPG up to 10MB</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-lg font-semibold flex items-center justify-center gap-2 hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Submitting...' : 'Add Product'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AddProduct;
