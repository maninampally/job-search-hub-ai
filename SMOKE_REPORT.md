# Smoke Test Report

Generated: 2026-03-23 10:07:55
Target: http://localhost:3001 (Docker)

- PASS health :: status=ok
- PASS mcp_health :: status=ok
- PASS mcp_list_jobs :: count=232
- PASS jobs_analytics_weekly :: apps=232
- PASS mcp_template_tools :: files=35,chars=23232
- PASS jobs_export_csv :: bytes=22631
- PASS mcp_create_job :: id=job_1774274871541_cvj1
- PASS mcp_update_job :: status=Interview
- PASS jobs_timeline :: entries=2
- PASS mcp_delete_job :: id=job_1774274871541_cvj1

Summary: passes=10 fails=0
