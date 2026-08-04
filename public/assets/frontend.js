$("#btn_login").on("click", function(){
    iapp_login();
});
$("#txt_pin, #txt_captcha").on('keypress', function(e){
    if(e.which === 13) {
      e.preventDefault();
      iapp_login();
    }
  });
function iapp_login()
{
    $("#btn_login").attr("disabled", "");
    $("#btn_login").text("Logging In ...");
    $.ajax({
        "url": "/api",
        "type": "POST",
        "data": "action=login&pin=" + $("#txt_pin").val() + "&captcha=" + $("#txt_captcha").val(),
        "success": function(data)
        {
            try { data = JSON.parse(data); }catch(err){}
            if(data.status == "success")
            {
                Swal.fire({title: "OK",text: data.message,icon: "success"});
                window.setTimeout(function(){ window.location = "/admin"; }, 1200);
            }
            else
            {
                if(data.status == "error")
                {
                    Swal.fire({title: "Oops",text: data.message,icon: "warning"});
                }
                else
                {
                    Swal.fire({title: "Oops",text: "Unknown Error Occured",icon: "error"});
                }
            }
            $("#btn_login").removeAttr("disabled");
            $("#btn_login").text(" Login ");
        },
        "error": function(data)
        {
            Swal.fire({title: "Oops",text: "Server or Network Error",icon: "error"});
            $("#btn_login").removeAttr("disabled");
            $("#btn_login").text(" Login ");
        }
    });
}
