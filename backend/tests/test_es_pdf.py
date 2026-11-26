from app.integrations.cloudinary_client import es_pdf


def test_pdf_real_se_reconoce_por_contenido():
    assert es_pdf(b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n1 0 obj")


def test_pdf_con_basura_antes_de_la_firma():
    assert es_pdf(b"\x00" * 200 + b"%PDF-1.4")


def test_no_pdf():
    assert not es_pdf(b"\x89PNG\r\n\x1a\n")
    assert not es_pdf(b"")
    assert not es_pdf(b"x" * 2000 + b"%PDF-1.4")
