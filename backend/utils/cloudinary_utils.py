
import cloudinary.uploader
from fastapi import UploadFile

# async def upload_pdf_to_cloudinary(file: UploadFile):
#     file_content = await file.read()
    
#     result = cloudinary.uploader.upload(
#         file_content,
#         folder="pdf_documents",
#         resource_type="raw",
#         format="pdf"
#     )
    
#     return {
#         "public_id": result.get("public_id"),
#         "url": result.get("secure_url"),
#         "size": result.get("bytes")
#     }

# async def upload_pdf_to_cloudinary(file: UploadFile):
    # print(f"Received file: {file.filename}, content_type: {file.content_type}")
    # try:
       # Read file content
        # file_content = await file.read()
        # 
        #Check if file is empty
        # if not file_content:
            # raise ValueError("File content is empty")
            # 
       # Upload to Cloudinary
        # result = cloudinary.uploader.upload(
            # file_content,
            # folder="pdf_documents",
            # resource_type="raw",
            # format="pdf"
        # )
        # 
       # Verify essential result data
        # if not result.get("secure_url") or not result.get("public_id"):
            # raise ValueError("Upload successful but required fields missing in response")
        # 
        # return {
            # "public_id": result.get("public_id"),
            # "url": result.get("secure_url"),
            # "size": result.get("bytes")
        # }
        # 
    # except Exception as e:
        #Log the error (add your logging logic here)
        # print(f"Error uploading PDF to Cloudinary: {str(e)}")
        # raise Exception(f"Failed to upload PDF: {str(e)}")


async def upload_pdf_to_cloudinary(file: UploadFile):
    print(f"Received file: {file.filename}, content_type: {file.content_type}")
    try:
        # Read file content
        await file.seek(0)
        file_content = await file.read()
        
        # Check if file is empty
        if not file_content:
            raise ValueError("File content is empty")
            
        # Upload to Cloudinary with public access
        result = cloudinary.uploader.upload(
            file_content,
            folder="pdf_documents",
            resource_type="raw",
            access_mode="public",  # Explicitly set public access
            format="pdf",
            use_filename=True,     # Preserve original filename
            unique_filename=True   # Ensure unique names
        )
        
        # Verify essential result data
        if not result.get("secure_url") or not result.get("public_id"):
            raise ValueError("Upload successful but required fields missing in response")
        
        print(f"Cloudinary upload result: {result}")
        
        return {
            "public_id": result.get("public_id"),
            "url": result.get("secure_url"),  # Using secure URL
            "size": result.get("bytes")
        }
        
    except Exception as e:
        # Log the error
        print(f"Error uploading PDF to Cloudinary: {str(e)}")
        raise Exception(f"Failed to upload PDF: {str(e)}")