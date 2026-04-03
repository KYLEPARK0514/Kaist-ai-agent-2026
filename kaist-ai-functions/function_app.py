from __future__ import annotations

import azure.functions as func

from blueprints.delete_document import bp as delete_document_bp
from blueprints.get_document import bp as get_document_bp
from blueprints.list_documents import bp as list_documents_bp
from blueprints.update_document import bp as update_document_bp
from blueprints.upload_document import bp as upload_document_bp

app = func.FunctionApp(http_auth_level=func.AuthLevel.FUNCTION)

app.register_blueprint(upload_document_bp)
app.register_blueprint(list_documents_bp)
app.register_blueprint(get_document_bp)
app.register_blueprint(update_document_bp)
app.register_blueprint(delete_document_bp)
