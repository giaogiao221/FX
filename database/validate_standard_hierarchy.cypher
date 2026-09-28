MATCH (s:KGNode)-[r1:STANDARD_RULE]->(c:KGNode)-[r2:STANDARD_RULE]->(rule:KGNode)
WHERE s.entity_type = 'Standard' AND c.entity_type = 'Clause' AND rule.entity_type IN ['ManagementRequirement','InspectionRequirement']
RETURN s.name AS standard, c.name AS clause, rule.name AS rule, type(r1) AS r1, type(r2) AS r2
LIMIT 5;
